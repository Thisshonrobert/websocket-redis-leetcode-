Browser
  ├── 1. WebSocket → register({ userId, problemId })
  ├── 2. HTTP → POST /submit({ userId, problemId, code, language })
  ↓
Primary Backend → Redis Queue → Worker → Redis PubSub("job-results")
                                                      ↓
                                             WebSocket Server → Browser

details Architecture:
Frontend (Browser)
   ├─ HTTP POST /submit (via Postman or Hoppscotch)
   │
   └┐ Express Backend (Primary Server)
        └┐ Redis Queue: "problems"
                ⬇
            Worker (processSubmission)
                ⬇
        Redis Pub/Sub Channel: "problem_done"
                ⬇
        PubSub Router (centralized)
                ⬇
     Sends result → Correct WebSocket Server (based on registry)
                ⬇
      WebSocket Server forwards → Registered WebSocket Clients