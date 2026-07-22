# Server Implementations

Choose a server implementation for your preferred language:

## 📁 Available Servers

| Language | Directory | Status | Port |
|----------|-----------|--------|------|
| JavaScript/Node.js | [./js](./js/) | ✅ Reference | 8080 |
| Python | [./python](./python/) | ✅ FastAPI | 8080 |
| Go | [./go](./go/) | ✅ gorilla/websocket | 8080 |
| Rust | [./rust](./rust/) | ✅ tokio + warp | 8080 |

## 🚀 Quick Start

### Node.js
```bash
cd servers/js
npm install
node server.js 8080
```

### Python
```bash
cd servers/python
pip install -r requirements.txt
python server.py 8080
```

### Go
```bash
cd servers/go
go mod download
go run server.go 8080
```

### Rust
```bash
cd servers/rust
cargo run 8080
```

## 📡 Protocol

All servers implement the same WebSocket protocol:

### Server → Client
- `role` - Assign master/slave role with client ID
- `session-update` - List of all connected sessions

### Client → Server
- `set-alias` - Set client alias
- `start` - Start synchronization (master only)
- `stop` - Stop synchronization (master only)
- `pause` - Pause synchronization (master only)
- `sync-ping` - Clock synchronization ping

### Client ↔ Client (via Server)
- `sync-pong` - Clock synchronization pong

See [PROTOCOL.md](./PROTOCOL.md) for detailed specification.

## 🎯 Features

All implementations support:
- ✅ Multiple client connections
- ✅ Master/Slave role assignment
- ✅ Session tracking and broadcasting
- ✅ Clock synchronization (sync-ping/pong)
- ✅ Control message forwarding
- ✅ Client alias management
- ✅ Automatic master reassignment on disconnect
- ✅ Static file serving for example page

## 📦 SDK Usage

Each server directory contains a complete, self-contained implementation that you can:

1. **Copy** into your project
2. **Customize** the port and configuration
3. **Extend** with additional features
4. **Deploy** to your infrastructure

### Example: Custom Port in Node.js
```javascript
// In servers/js/server.js, change line 12:
const PORT = process.argv[2] || 8080; // Now accepts custom port

// Start with custom port:
node server.js 9000
```

### Example: Custom Static Directory in Python
```python
# In servers/python/server.py, change line 14:
EXAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "example")
# Change to your directory:
EXAMPLE_DIR = "/path/to/your/static/files"
```

## 🔧 Deployment

### Docker (Node.js Example)
```dockerfile
FROM node:18
WORKDIR /app
COPY servers/js/package.json servers/js/server.js ./
RUN npm install
EXPOSE 8080
CMD ["node", "server.js", "8080"]
```

### Systemd Service (Python Example)
```ini
[Unit]
Description=SyncAudio Server (Python)
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/sync-audio-js/servers/python
ExecStart=/usr/bin/python3 server.py 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📊 Performance

| Language | Memory | CPU | Connections |
|----------|--------|-----|-------------|
| Node.js | Medium | Medium | ~1000 |
| Python | High | Medium | ~500 |
| Go | Low | Low | ~10000 |
| Rust | Low | Low | ~10000 |

For production use with many connections, Go or Rust are recommended.
