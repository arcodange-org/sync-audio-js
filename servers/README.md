# SyncAudio Server Implementations

This directory contains minimal server implementations for SyncAudio synchronization in various languages.

## Protocol

The SyncAudio library expects a WebSocket server that implements the following protocol:

### WebSocket Messages

#### Server → Client
```json
{
  "type": "role",
  "role": "master" | "slave",
  "clientId": "unique-client-id"
}
```

```json
{
  "type": "session-update",
  "sessions": [
    {
      "clientId": "client-1",
      "role": "master",
      "alias": "Happy Blue Lion"
    }
  ]
}
```

#### Client → Server
```json
{
  "type": "set-alias",
  "alias": "Happy Blue Lion"
}
```

```json
{
  "type": "start",
  "startTime": 1234567890
}
```

```json
{
  "type": "stop"
}
```

```json
{
  "type": "pause"
}
```

#### Client ↔ Client (via Server)
```json
{
  "type": "sync-ping",
  "requestId": "unique-id",
  "T1": 1234567890
}
```

```json
{
  "type": "sync-pong",
  "requestId": "unique-id",
  "T1": 1234567890,
  "T4": 1234567891
}
```

## Server Requirements

1. Maintain a list of connected clients
2. Assign roles: first client is "master", others are "slaves"
3. Broadcast messages from master to all slaves
4. Handle client disconnections and reassign master if needed
5. Track client aliases and session information

## Available Implementations

- [JavaScript/Node.js](./js/) - Reference implementation
- [Python](./python/) - Using FastAPI + WebSockets
- [Go](./go/) - Using gorilla/websocket
- [Rust](./rust/) - Using tokio + tungstenite

## Quick Start

### Node.js
```bash
cd servers/js
npm install
node server.js
```

### Python
```bash
cd servers/python
pip install -r requirements.txt
python server.py
```

### Go
```bash
cd servers/go
go mod download
go run server.go
```

### Rust
```bash
cd servers/rust
cargo run
```

All servers will start on port 8080 by default and serve the example page from `../example/index.html`.
