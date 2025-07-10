import express from 'express';
import { createClient } from 'redis';
import WebSocket from 'ws';

const app = express();
app.use(express.json());

(async () => {
  const redis = createClient();
  await redis.connect();

  // user:problem → ws server url
  const registry = new Map<string, string>();

  app.post('/register', (req, res) => {
    const { userId, problemId, serverUrl } = req.body;
    const key = `${userId}:${problemId}`;
    registry.set(key, serverUrl);
    res.sendStatus(200);
  });

  redis.subscribe('problem_done', async (msg) => {
    const { userId, problemId, result } = JSON.parse(msg);
    const key = `${userId}:${problemId}`;
    const wsUrl = registry.get(key);

    if (wsUrl) {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => ws.send(JSON.stringify({ userId, problemId, result })));
    }
  });

  app.listen(4000, () => console.log('PubSub Router on :4000'));
})();