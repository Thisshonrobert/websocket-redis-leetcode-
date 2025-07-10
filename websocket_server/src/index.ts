import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const { type, userId, problemId } = JSON.parse(msg.toString());
    if (type === 'register') {
      const key = `${userId}:${problemId}`;
      if (!clients.has(key)) clients.set(key, new Set());
      clients.get(key)!.add(ws);
      // Notify PubSub Router
      fetch('http://localhost:4000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, problemId, serverUrl: 'ws://localhost:8080' })
      });
    }
  });
});

export function broadcast(userId: string, problemId: string, result: any) {
  const key = `${userId}:${problemId}`;
  const message = JSON.stringify(result);
  clients.get(key)?.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
}