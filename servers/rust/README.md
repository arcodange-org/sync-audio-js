# SyncAudio Server - Rust

A minimal WebSocket server for audio synchronization across multiple devices, implemented with tokio and warp.

## Quick Start

```bash
# Build and run (default port: 8080)
cargo run

# Or with custom port
cargo run 9000
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Features

- ✅ WebSocket server with SyncAudio protocol
- ✅ Automatic master/slave role assignment
- ✅ Session tracking and broadcasting
- ✅ Clock synchronization support
- ✅ Static file serving for example page
- ✅ Automatic master reassignment on disconnect
- ✅ High performance with async/await
- ✅ Memory safety with Rust
- ✅ Low memory footprint

## Usage

### Basic Usage
```bash
cargo run
```

### Custom Port
```bash
cargo run 8080
```

### Build and Run
```bash
cargo build --release
./target/release/sync-audio-server-rust 8080
```

## Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)

### Command Line Arguments
```
Usage: cargo run [port]

Arguments:
  port    Port number (default: 8080)
```

## API

### WebSocket Endpoint
- URL: `ws://localhost:8080`
- Protocol: SyncAudio WebSocket Protocol

See [PROTOCOL.md](../PROTOCOL.md) for message format details.

### HTTP Endpoints
- `GET /` - Serve example page
- `GET /index.html` - Serve example page
- `GET /dist/*` - Serve built library files
- `GET /example/*` - Serve example files

## Deployment

### Docker
```dockerfile
FROM rust:1.70
WORKDIR /app
COPY . .
RUN cargo build --release
EXPOSE 8080
CMD ["./target/release/sync-audio-server-rust", "8080"]
```

Build and run:
```bash
docker build -t sync-audio-server-rust .
docker run -p 8080:8080 sync-audio-server-rust
```

### Systemd Service
```ini
[Unit]
Description=SyncAudio Server (Rust)
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/sync-audio-server
ExecStart=/path/to/sync-audio-server-rust 8080
Restart=always
Environment=RUST_BACKTRACE=1

[Install]
WantedBy=multi-user.target
```

### Binary Deployment
```bash
# Build for release
cargo build --release

# The binary will be at:
# Linux/macOS: ./target/release/sync-audio-server-rust
# Windows: ./target/release/sync-audio-server-rust.exe
```

## Development

### Project Structure
```
servers/rust/
├── Cargo.toml         # Rust package configuration
├── src/
│   └── main.rs        # Main server implementation
└── README.md          # This file
```

### Dependencies
- `tokio` - Async runtime
- `warp` - Web framework
- `serde` - JSON serialization
- `serde_json` - JSON support
- `rand` - Random number generation
- `chrono` - Date/time handling

## Troubleshooting

### Port Already in Use
```
Error: Os { code: 98, kind: AddrInUse, message: "Address already in use" }
```

Solution: Use a different port or kill the existing process:
```bash
lsof -i :8080
kill -9 <PID>
```

### Compilation Errors
```
error: could not compile `sync-audio-server-rust`
```

Solution: Update dependencies:
```bash
cargo update
cargo build
```

### WebSocket Connection Failed
- Verify the server is running
- Check firewall settings
- Ensure you're using the correct port

## Performance

Rust implementation is optimized for:
- **Maximum performance**: Native speed with zero-cost abstractions
- **High concurrency**: Thousands of simultaneous connections
- **Low latency**: Efficient async I/O
- **Memory safety**: No garbage collector, no segfaults
- **Scalability**: Easy to scale horizontally

For production deployments with maximum performance requirements, this is the recommended implementation.

## Cross-Compilation

### Build for Linux from macOS
```bash
# Install cross-compilation target
rustup target add x86_64-unknown-linux-gnu

# Build
cargo build --release --target x86_64-unknown-linux-gnu

# Binary will be at:
# ./target/x86_64-unknown-linux-gnu/release/sync-audio-server-rust
```

### Build for Windows from Linux
```bash
# Install cross-compilation target
rustup target add x86_64-pc-windows-gnu

# Install mingw toolchain
sudo apt-get install gcc-mingw-w64

# Build
cargo build --release --target x86_64-pc-windows-gnu
```

## License

MIT License - See [LICENSE](../../LICENSE)
