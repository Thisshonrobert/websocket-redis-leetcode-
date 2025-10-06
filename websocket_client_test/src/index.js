const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log(' Connected to WebSocket server');
    
    ws.send(JSON.stringify({
        type: "register",
        userId: "alice", 
        problemId: "p1"
    }));
    console.log(' Registered interest in alice:p1');
});

ws.on('message', (data) => {
    
    try {
        const message = JSON.parse(data.toString());
        console.log(' Received:', message);
    } catch (error) {
        console.log(' Error parsing message:', error);
        console.log('Raw data received:', data.toString());
    }
});

ws.on('error', (error) => {
    console.log(' WebSocket error:', error);
});

ws.on('close', () => {
    console.log(' WebSocket connection closed')
})
