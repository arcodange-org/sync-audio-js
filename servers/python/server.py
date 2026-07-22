"""
SyncAudio Server - Python Implementation

A minimal WebSocket server for audio synchronization across multiple devices.

Usage:
    python server.py [port]

Example:
    python server.py 8080

Then open http://localhost:8080 in your browser.

Requirements:
    pip install fastapi uvicorn websockets
"""

import asyncio
import json
import os
import random
import string
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app = FastAPI(title="SyncAudio Server")

# Configuration
PORT = int(os.getenv("PORT", 8080))
EXAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "example")

# Store connected clients
clients: Dict[str, WebSocket] = {}
client_info: Dict[str, Dict] = {}
master: Optional[str] = None


class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.clients: Dict[str, WebSocket] = {}
        self.client_info: Dict[str, Dict] = {}
        self.master: Optional[str] = None
    
    async def connect(self, websocket: WebSocket) -> str:
        """Add a new client and return its ID"""
        client_id = self.generate_client_id()
        await websocket.accept()
        self.clients[client_id] = websocket
        self.client_info[client_id] = {
            "role": None,
            "alias": None,
            "connected_at": datetime.now().isoformat()
        }
        
        # Assign role
        if self.master is None:
            self.master = client_id
            self.client_info[client_id]["role"] = "master"
        else:
            self.client_info[client_id]["role"] = "slave"
        
        # Send role to client
        await websocket.send_json({
            "type": "role",
            "role": self.client_info[client_id]["role"],
            "clientId": client_id
        })
        
        # Send session list
        await self.broadcast_session_update()
        
        print(f"[{datetime.now().isoformat()}] Client connected: {client_id} (Total: {len(self.clients)})")
        return client_id
    
    def disconnect(self, client_id: str):
        """Remove a client"""
        if client_id in self.clients:
            del self.clients[client_id]
        if client_id in self.client_info:
            del self.client_info[client_id]
        
        # Reassign master if needed
        if self.master == client_id:
            self.master = None
            if self.clients:
                self.master = next(iter(self.clients.keys()))
                self.client_info[self.master]["role"] = "master"
                # Notify new master
                asyncio.create_task(self.clients[self.master].send_json({
                    "type": "role",
                    "role": "master",
                    "clientId": self.master
                }))
        
        print(f"[{datetime.now().isoformat()}] Client disconnected: {client_id} (Remaining: {len(self.clients)})")
        asyncio.create_task(self.broadcast_session_update())
    
    async def broadcast_session_update(self):
        """Broadcast session list to all clients"""
        sessions = []
        for cid, info in self.client_info.items():
            sessions.append({
                "clientId": cid,
                "role": info["role"],
                "alias": info.get("alias", "Unknown")
            })
        
        message = {
            "type": "session-update",
            "sessions": sessions,
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
        for cid, ws in self.clients.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"Error sending to {cid}: {e}")
    
    async def broadcast_control(self, data: dict, sender_id: str):
        """Broadcast control messages from master to slaves"""
        if self.master != sender_id:
            return
        
        for cid, ws in self.clients.items():
            if cid != sender_id:
                try:
                    await ws.send_json(data)
                except Exception as e:
                    print(f"Error sending to {cid}: {e}")
    
    def generate_client_id(self) -> str:
        """Generate a unique client ID"""
        return f"client-{int(datetime.now().timestamp() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=4))}"


manager = ConnectionManager()


@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for SyncAudio protocol"""
    client_id = await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                print(f"[{datetime.now().isoformat()}] Received from {client_id}: {message_type}")
                
                if message_type == "sync-ping":
                    # Handle clock sync ping
                    if client_id != manager.master:
                        await websocket.send_json({
                            "type": "sync-pong",
                            "requestId": message.get("requestId"),
                            "T1": message.get("T1"),
                            "T4": int(datetime.now().timestamp() * 1000)
                        })
                
                elif message_type in ["start", "stop", "pause"]:
                    # Forward control messages
                    await manager.broadcast_control(message, client_id)
                
                elif message_type == "set-alias":
                    # Update alias
                    manager.client_info[client_id]["alias"] = message.get("alias")
                    await manager.broadcast_session_update()
                    print(f"[{datetime.now().isoformat()}] Client {client_id} set alias: {message.get('alias')}")
                
                else:
                    print(f"[{datetime.now().isoformat()}] Unknown message type: {message_type}")
                    
            except json.JSONDecodeError:
                print(f"[{datetime.now().isoformat()}] Invalid JSON from {client_id}")
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Error with {client_id}: {e}")
        manager.disconnect(client_id)


# Serve static files
@app.get("/{path:path}")
async def serve_static(path: str):
    """Serve static files from example directory"""
    file_path = os.path.join(EXAMPLE_DIR, path)
    
    if not os.path.exists(file_path):
        file_path = os.path.join(EXAMPLE_DIR, "index.html")
    
    if os.path.isfile(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Determine content type
        ext = os.path.splitext(file_path)[1].lower()
        content_type = "text/html"
        if ext == ".css":
            content_type = "text/css"
        elif ext == ".js":
            content_type = "application/javascript"
        elif ext == ".json":
            content_type = "application/json"
        elif ext == ".mp3":
            content_type = "audio/mpeg"
        
        return HTMLResponse(content, media_type=content_type)
    
    return HTMLResponse("Not Found", status_code=404)


@app.get("/")
async def serve_index():
    """Serve index.html"""
    file_path = os.path.join(EXAMPLE_DIR, "index.html")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return HTMLResponse(content, media_type="text/html")


if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("  SyncAudio Server Running (Python)")
    print("  HTTP:  http://localhost:", PORT)
    print("  WS:    ws://localhost:", PORT)
    print("  Example: http://localhost:", PORT, "/index.html")
    print("=" * 50)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="warning"
    )
