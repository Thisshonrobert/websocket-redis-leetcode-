🧠 Real-time Code Submission System with Redis, Pub/Sub, and WebSockets

This project demonstrates a real-time system using Express.js, Redis (for Queue and Pub/Sub), and WebSockets to deliver asynchronous code submission results to clients.

---

## 📦 Architecture Overview

**Frontend (Browser or API Client)**
   ├─ HTTP POST `/submit` (via Postman or Hoppscotch)
   │
   └──▶ **Express Backend (Primary Server)**
         └──▶ Redis Queue: `"problems"`
                  ⬇
               **Worker** (processSubmission)
                  ⬇
           Redis Pub/Sub Channel: `"problem_done"`
                  ⬇
          **WebSocket Server** (localhost:8080)
                  ⬇
           WebSocket Client (browser or Hoppscotch WS)

---

## 🧪 Test Setup Instructions

### 1. Submit Code (via Postman or Hoppscotch HTTP)

**Endpoint:**  
`POST http://localhost:3000/submit`

**Headers:**  
`Content-Type: application/json`

**Body Example:**
```json
{
  "userId": "alice",
  "problemId": "p1",
  "code": "print('Hello')",
  "language": "python"
}
```

---

### 2. Connect as WebSocket Client (Hoppscotch WS Tab or browser)

**WebSocket URL:**  
`ws://localhost:8080`

**Message to Send (register interest):**
```json
{
  "type": "register",
  "userId": "alice",
  "problemId": "p1"
}
```
This tells the WebSocket server that this client wants to receive the result for this specific problem.

---

### 3. How Results Are Delivered

- When the worker finishes processing, it publishes a message to the Redis channel `"problem_done"` with:
  ```json
  {
    "userId": "alice",
    "problemId": "p1",
    "status": "OUTPUT:TLE"
  }
  ```
- The WebSocket server listens to this channel, looks up all registered clients for that `(userId, problemId)` using a map:
  ```
  Map<"userId:problemId", Set<WebSocket>>
  ```
- The server sends the result to all registered WebSocket clients:
  ```json
  {
    "type": "submission_result",
    "userId": "alice",
    "problemId": "p1",
    "status": "OUTPUT:TLE"
  }
  ```

---

### 4. WebSocket Server Details

- On connection, clients must send a `register` message with `userId` and `problemId`.
- The server confirms registration:
  ```json
  {
    "type": "registration_confirmed",
    "message": "Listening for results of p1"
  }
  ```
- When the result is available, the server pushes it to all registered clients for that submission.

---

### 5. Unregistering

- When a WebSocket client disconnects, it is automatically removed from the map.

---

**Summary:**  
- Submit code via HTTP POST.
- Register for results via WebSocket.
- Receive real-time results when available.

---