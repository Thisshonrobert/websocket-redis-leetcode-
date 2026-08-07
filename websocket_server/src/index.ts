import { createClient } from 'redis';
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });

// key = "userId:problemId" -> set of sockets waiting for that result
const clients = new Map<string, Set<WebSocket>>();

// BUG FIX (O(n) cleanup): the old code found a disconnected socket by
// scanning every key in `clients`. This reverse map remembers which
// key(s) each socket registered under, so on disconnect we go straight
// to the right entries instead of scanning everything.
const socketKeys = new Map<WebSocket, Set<string>>();

// BUG FIX (race condition): if the worker finishes and publishes a
// result BEFORE the browser has sent its "register" message (e.g. the
// worker is fast, the browser tab is slow to open the socket), the old
// code just dropped the message on the floor forever. Now we stash it
// here, keyed the same way as `clients`, and hand it over as soon as
// the matching client registers.
const pendingResults = new Map<string, any>();

// pending results older than this are considered abandoned and swept
// away so this map can't grow forever if nobody ever registers.
const PENDING_TTL_MS = 5 * 60 * 1000;

function buildKey(userId: string, problemId: string) {
  return `${userId}:${problemId}`;
}

// periodically clear out old unclaimed results
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingResults.entries()) {
    if (now - entry.storedAt > PENDING_TTL_MS) {
      pendingResults.delete(key);
    }
  }
}, 60 * 1000);

(async () => {
  const redisSubscriber = createClient();

  // BUG FIX: neither the worker nor this server had a Redis error
  // handler, so a Redis blip would crash the process silently
  // (unhandled 'error' event). Just log it so the process stays up
  // and the failure is visible.
  redisSubscriber.on('error', (err) => console.error('Redis subscriber error:', err));

  await redisSubscriber.connect();

  redisSubscriber.subscribe('problem_done', (msg) => {
    // BUG FIX: JSON.parse throws on malformed messages, which would
    // crash this whole callback (and take down result delivery for
    // every other client too). Wrap it so one bad message can't do that.
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (err) {
      console.error('Received malformed message on problem_done:', msg);
      return;
    }

    const { userId, problemId, status } = parsed;
    const key = buildKey(userId, problemId);
    const wsSet = clients.get(key);

    const response_message = JSON.stringify({
      type: 'submission_result',
      userId,
      problemId,
      status
    });

    if (wsSet && wsSet.size > 0) {
      wsSet.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(response_message);
        }
      });
    } else {
      // nobody is listening yet — save it so a late "register" can still get it
      pendingResults.set(key, { message: response_message, storedAt: Date.now() });
    }
  });
})();

wss.on('connection', (ws) => {
  console.log('websocket client connected');

  // BUG FIX (dead connections): if a client's network drops without a
  // clean close handshake, 'close' may never fire, and the socket (and
  // its Map entry) leaks forever. A ping/pong heartbeat lets us detect
  // and clean up sockets that stopped responding.
  let isAlive = true;
  ws.on('pong', () => { isAlive = true; });
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      ws.terminate(); // triggers the 'close' handler below, which cleans up `clients`
      return;
    }
    isAlive = false;
    ws.ping();
  }, 30 * 1000);

  ws.on('message', (data) => {
    // BUG FIX: same JSON.parse crash risk as above, but for messages
    // coming from the browser this time.
    let parsed;
    try {
      parsed = JSON.parse(data.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, userId, problemId } = parsed;
    if (type !== 'register') {
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
      return;
    }

    const key = buildKey(userId, problemId);

    if (!clients.has(key)) {
      clients.set(key, new Set());
    }
    clients.get(key)!.add(ws);

    // remember this key so disconnect cleanup is O(1), not O(n)
    if (!socketKeys.has(ws)) {
      socketKeys.set(ws, new Set());
    }
    socketKeys.get(ws)!.add(key);

    ws.send(JSON.stringify({
      type: 'registration_confirmed',
      message: `Listening for results of ${problemId}`
    }));

    // deliver a result that arrived before this client registered
    const pending = pendingResults.get(key);
    if (pending) {
      ws.send(pending.message);
      pendingResults.delete(key);
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeat);

    const keys = socketKeys.get(ws);
    if (!keys) return;

    for (const key of keys) {
      const wsSet = clients.get(key);
      if (!wsSet) continue;
      wsSet.delete(ws);
      console.log(`Client removed from ${key}`);
      if (wsSet.size === 0) {
        clients.delete(key);
      }
    }
    socketKeys.delete(ws);
  });
});

console.log('WebSocket server running on port 8080');

// KNOWN LIMITATION (not fixed here, needs a bigger design change):
// `clients` and `pendingResults` live only in this process's memory.
// If you ever run more than one instance of this server (for more
// capacity), Redis pub/sub will deliver each message to ALL instances,
// but only the instance that actually holds the matching socket in its
// own `clients` map can do anything with it — the others will just
// have an empty lookup and silently drop it. Fixing this for real needs
// "sticky sessions" (always route a given user to the same instance) or
// a shared registry (e.g. store which instance owns which socket in
// Redis itself).
