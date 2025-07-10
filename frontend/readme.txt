🧠 Real-time Code Submission System with Redis, Pub/Sub, and WebSockets

This project demonstrates a real-time system using Express.js, Redis (for Queue and Pub/Sub), and WebSockets to deliver asynchronous code submission results to clients.

📦 Architecture Overview

Frontend (Browser)
   ├─ HTTP POST /submit (via Postman or Hoppscotch)
   │
   └──▶ Express Backend (Primary Server)
         └──▶ Redis Queue: "problems"
                  ⬇
               Worker (processSubmission)
                  ⬇
           Redis Pub/Sub Channel: "problem_done"
                  ⬇
          PubSub Listener (Subscriber)
                  ⬇
           WebSocket Server (localhost:8080)
                  ⬇
               Frontend WebSocket Client

🧪 Test Setup Instructions

✅ 1. Submit Code (via Postman or Hoppscotch HTTP)

Endpoint: POST http://localhost:3000/submit

Headers:

Content-Type: application/json

Body:

{
  "userId": "u1",
  "problemId": "p1",
  "code": "print('Hello')",
  "language": "python"
}

✅ 2. Connect as WebSocket Client (Hoppscotch WS Tab)

WebSocket URL:

ws://localhost:8080

Message to Send:

{
  "type": "register",
  "userId": "u1",
  "problemId": "p1"
}

This tells the WebSocket server that this browser is interested in the result of this specific problem.

🔁 Once the worker finishes processing and publishes to Redis, the WebSocket server will push the result to this client.