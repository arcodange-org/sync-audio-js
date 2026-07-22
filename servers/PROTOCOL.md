# SyncAudio WebSocket Protocol

This document describes the WebSocket protocol used by SyncAudio for multi-device audio synchronization.

## Connection

- **URL**: `ws://[host]:[port]` (default: `ws://localhost:8080`)
- **Protocol**: WebSocket (RFC 6455)
- **Message Format**: JSON

## Message Types

### Server → Client Messages

#### 1. Role Assignment
Sent when a client connects to assign its role (master or slave).

```json
{
  "type": "role",
  "role": "master" | "slave",
  "clientId": "unique-client-identifier"
}
```

**Fields:**
- `type`: Always `"role"`
- `role`: The role assigned to this client (`"master"` or `"slave"`)
- `clientId`: Unique identifier for this client

**Notes:**
- The first client to connect becomes the master
- When master disconnects, the next client becomes master
- Only the master can send control commands

---

#### 2. Session Update
Broadcast to all clients when session list changes.

```json
{
  "type": "session-update",
  "sessions": [
    {
      "clientId": "client-1",
      "role": "master",
      "alias": "Happy Blue Lion"
    },
    {
      "clientId": "client-2",
      "role": "slave",
      "alias": "Sad Red Tiger"
    }
  ],
  "timestamp": 1234567890123
}
```

**Fields:**
- `type`: Always `"session-update"`
- `sessions`: Array of session objects
- `timestamp`: Unix timestamp in milliseconds

**Session Object:**
- `clientId`: Unique client identifier
- `role`: Client role (`"master"` or `"slave"`)
- `alias`: Human-readable alias (from localStorage)

---

### Client → Server Messages

#### 1. Set Alias
Sent by client to set its display alias.

```json
{
  "type": "set-alias",
  "alias": "Happy Blue Lion"
}
```

**Fields:**
- `type`: Always `"set-alias"`
- `alias`: The alias to display for this client

**Notes:**
- Aliases are typically generated client-side and stored in localStorage
- Format: `{Adjective} {Color} {Animal}` (e.g., "Happy Blue Lion")

---

#### 2. Start Synchronization
Sent by master to start synchronized playback.

```json
{
  "type": "start",
  "startTime": 1234567890123
}
```

**Fields:**
- `type`: Always `"start"`
- `startTime`: Unix timestamp in milliseconds when playback should start

**Notes:**
- Only the master can send this message
- Server broadcasts to all slaves
- Clients use clock synchronization to adjust for network latency

---

#### 3. Stop Synchronization
Sent by master to stop playback.

```json
{
  "type": "stop"
}
```

**Fields:**
- `type`: Always `"stop"`

**Notes:**
- Only the master can send this message
- Server broadcasts to all slaves

---

#### 4. Pause Synchronization
Sent by master to pause playback.

```json
{
  "type": "pause"
}
```

**Fields:**
- `type`: Always `"pause"`

**Notes:**
- Only the master can send this message
- Server broadcasts to all slaves

---

#### 5. Clock Synchronization Ping
Sent by any client to measure network latency.

```json
{
  "type": "sync-ping",
  "requestId": "unique-request-id",
  "T1": 1234567890123
}
```

**Fields:**
- `type`: Always `"sync-ping"`
- `requestId`: Unique identifier for this ping request
- `T1`: Client's timestamp when ping was sent (Unix ms)

**Notes:**
- Used for clock synchronization between clients
- Server responds with `sync-pong`
- Typically sent to non-master clients

---

### Server → Client Messages (Continued)

#### 3. Clock Synchronization Pong
Response to `sync-ping` message.

```json
{
  "type": "sync-pong",
  "requestId": "unique-request-id",
  "T1": 1234567890123,
  "T4": 1234567890456
}
```

**Fields:**
- `type`: Always `"sync-pong"`
- `requestId`: The request ID from the original ping
- `T1`: Original T1 from ping message
- `T4`: Server's timestamp when pong is sent (Unix ms)

**Notes:**
- Client uses T1, T4, and its own T2, T3 to calculate clock offset
- Used for precise audio synchronization

---

## Clock Synchronization Algorithm

The SyncAudio library uses a modified version of the Network Time Protocol (NTP) for clock synchronization:

```
Client A (Master)                    Server                    Client B (Slave)
    |------ T1 (ping) ---------------->|                          
    |                               |------ T4 (pong) -------->|
    |<----- T2 (pong received) -------|                          
    |                               |<---- T3 (pong sent) ------|
```

**Clock Offset Calculation:**
```javascript
// Client B calculates:
const T2 = Date.now(); // When pong received
const offset = ((T2 - T1) - (T4 - T3)) / 2;
```

Where:
- T1: Client A sends ping
- T2: Client B receives pong
- T3: Server sends pong (T4 in message)
- T4: Server receives ping

**Note:** The actual implementation may vary slightly based on the library version.

---

## Error Handling

### Connection Errors
- Server should close connection on invalid messages
- Clients should reconnect on connection loss
- Master reassignment should be automatic

### Message Validation
- All messages must be valid JSON
- Required fields must be present
- Message types must be recognized

---

## Implementation Notes

### Server Requirements
1. Maintain list of connected clients
2. Track which client is master
3. Broadcast messages from master to all slaves
4. Handle client disconnections gracefully
5. Reassign master when current master disconnects
6. Support clock synchronization (ping/pong)

### Client Requirements
1. Connect to WebSocket server
2. Handle role assignment
3. Send alias on connection
4. Forward control messages to audio player
5. Participate in clock synchronization
6. Handle disconnections and reconnects

---

## Example Session Flow

```
1. Client A connects
   Server: {"type": "role", "role": "master", "clientId": "client-1"}
   Server: {"type": "session-update", "sessions": [{"clientId": "client-1", "role": "master", "alias": "..."}]}

2. Client B connects
   Server: {"type": "role", "role": "slave", "clientId": "client-2"}
   Server: {"type": "session-update", "sessions": [...]}

3. Client A sets alias
   Client A: {"type": "set-alias", "alias": "Happy Blue Lion"}
   Server: {"type": "session-update", "sessions": [...]}

4. Client A starts sync
   Client A: {"type": "start", "startTime": 1234567890123}
   Server: (broadcasts to Client B)
   Client B: Receives start command, begins playback

5. Clock synchronization
   Client B: {"type": "sync-ping", "requestId": "abc123", "T1": 1234567890000}
   Server: {"type": "sync-pong", "requestId": "abc123", "T1": 1234567890000, "T4": 1234567890100}
   Client B: Calculates clock offset
```

---

## Security Considerations

1. **Authentication**: Not implemented in base protocol (add as needed)
2. **Rate Limiting**: Server should limit message rate per client
3. **Message Size**: Limit maximum message size
4. **CORS**: Configure appropriately for your deployment
5. **HTTPS**: Use wss:// for production deployments

---

## Extensions

The protocol can be extended with additional message types:

### Proposed Extensions
- `"volume"`: Set volume level
- `"seek"`: Seek to specific position
- `"track-change"`: Change audio track
- `"latency-report"`: Report measured latency
- `"ping"`: Keepalive message

Example:
```json
{
  "type": "volume",
  "volume": 0.75
}
```
