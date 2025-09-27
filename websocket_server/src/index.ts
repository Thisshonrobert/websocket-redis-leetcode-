import { createClient } from 'redis';
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map<string, Set<WebSocket>>();

(async () => {
  const redisSubscriber = createClient();
  await redisSubscriber.connect();

  redisSubscriber.subscribe('problem_done', (msg) => {
    console.log("Subscribed to Problem_solved")
    const { userId, problemId, status } = JSON.parse(msg);
    const key = `${userId}:${problemId}`;
    const wsSet = clients.get(key);
    console.log(wsSet);

    if (wsSet) {
      const response_message = JSON.stringify({
        type: 'submission_result',
        userId,
        problemId,
        status
      });
      console.log(response_message);
      wsSet.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(response_message)
        }
      })

    }
  })
})();

wss.on('connection', (ws) => {
  console.log(' websocket client conneced');
  ws.on('message', (data) => {
    const { type, userId, problemId } = JSON.parse(data.toString());
    const key = `${userId}:${problemId}`;
    if (type === "register") {
      if (!clients.has(key)) {
        clients.set(key, new Set());
      }
      clients.get(key)?.add(ws);
    }
 
    ws.send(JSON.stringify({
      type: 'registration_confirmed',
      message: `Listening for results of ${problemId}`
    }));
  })

  ws.on('close', () => {
    for (const [key, wsSet] of clients.entries()) {
      if (wsSet.has(ws)) {
        wsSet.delete(ws);
        console.log(`Client removed from ${key}`);
        if (wsSet.size === 0) {
                    clients.delete(key);
                }
      }
    }
  })
})
console.log('WebSocket server running on port 8080');
