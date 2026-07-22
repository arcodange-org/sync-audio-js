#!/usr/bin/env python3
"""
Minimal WebSocket server for SyncAudio testing
Implements the basic protocol to allow QA tests to run

Usage:
    python tests/test_server.py [--port 8080] [--latency 100]

Features:
    - WebSocket server implementing SyncAudio protocol
    - Simulated latency for testing
    - Multiple client support
    - Role assignment (master/slave)
"""

import asyncio
import json
import random
import string
import argparse
from websockets import serve, WebSocketServerProtocol
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ClientInfo:
    """Information about a connected client"""
    
    def __init__(self, websocket: WebSocketServerProtocol, client_id: str):
        self.websocket = websocket
        self.client_id = client_id
        self.alias = f"TestClient-{client_id[:8]}"
        self.role = "slave"  # Default role
        self.latency = 0  # Simulated latency in ms
        self.jitter = 0  # Simulated jitter in ms
        self.packet_loss = 0  # Simulated packet loss %
        self.is_master = False
        
    def to_dict(self) -> dict:
        return {
            "clientId": self.client_id,
            "alias": self.alias,
            "role": self.role
        }


class SyncAudioTestServer:
    """
    Test WebSocket server implementing SyncAudio protocol
    """
    
    def __init__(self, port: int = 8080, simulated_latency: int = 0):
        self.port = port
        self.simulated_latency = simulated_latency
        self.clients: Dict[str, ClientInfo] = {}
        self.client_counter = 0
        self.master_client_id: Optional[str] = None
        
    async def generate_client_id(self) -> str:
        """Generate a unique client ID"""
        self.client_counter += 1
        return f"test-{self.client_counter:04d}-{random_string(4)}"
    
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle a new WebSocket connection"""
        try:
            # Generate client ID
            client_id = await self.generate_client_id()
            
            # Create client info
            client = ClientInfo(websocket, client_id)
            self.clients[client_id] = client
            
            # If no master yet, make this client the master
            if self.master_client_id is None:
                client.role = "master"
                client.is_master = True
                self.master_client_id = client_id
                logger.info(f"New master client: {client_id}")
            else:
                logger.info(f"New slave client: {client_id}")
            
            # Send role assignment
            await self.send_message(websocket, {
                "type": "role",
                "role": client.role,
                "clientId": client_id
            })
            
            # Send session update to all clients
            await self.broadcast_session_update()
            
            # Main message loop
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_type = data.get("type")
                    client_id = data.get("clientId", client_id)
                    
                    logger.debug(f"Received message from {client_id}: {message_type}")
                    
                    # Handle different message types
                    if message_type == "set-alias":
                        alias = data.get("alias", "")
                        if client_id in self.clients:
                            self.clients[client_id].alias = alias
                            await self.broadcast_session_update()
                    
                    elif message_type == "start":
                        # Forward start message to all clients
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "play":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "pause":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "stop":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "seek":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "timeupdate":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "seeking":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "track-change":
                        await self.broadcast_message(data, exclude_client=client_id)
                    
                    elif message_type == "request-sessions":
                        # Send session info to requesting client
                        await self.send_message(websocket, {
                            "type": "session-update",
                            "sessions": [c.to_dict() for c in self.clients.values()]
                        })
                    
                    else:
                        logger.warning(f"Unknown message type: {message_type}")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON message: {e}")
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
                    
        except Exception as e:
            logger.error(f"Error with client {client_id}: {e}")
        finally:
            # Clean up on disconnect
            if client_id in self.clients:
                del self.clients[client_id]
                
                # If master disconnected, assign new master
                if client_id == self.master_client_id and self.clients:
                    new_master_id = next(iter(self.clients.keys()))
                    self.clients[new_master_id].role = "master"
                    self.clients[new_master_id].is_master = True
                    self.master_client_id = new_master_id
                    
                    # Notify new master
                    await self.send_message(self.clients[new_master_id].websocket, {
                        "type": "role",
                        "role": "master",
                        "clientId": new_master_id
                    })
                
                # Broadcast updated session list
                await self.broadcast_session_update()
                logger.info(f"Client disconnected: {client_id}")
                
    async def send_message(self, websocket: WebSocketServerProtocol, message: dict):
        """Send a message to a client with optional latency simulation"""
        try:
            # Simulate latency if configured
            if self.simulated_latency > 0:
                await asyncio.sleep(self.simulated_latency / 1000)
            
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            
    async def broadcast_message(self, message: dict, exclude_client: Optional[str] = None):
        """Broadcast a message to all clients except one"""
        for client_id, client in self.clients.items():
            if client_id != exclude_client:
                await self.send_message(client.websocket, message)
                
    async def broadcast_session_update(self):
        """Broadcast updated session list to all clients"""
        sessions = [c.to_dict() for c in self.clients.values()]
        message = {
            "type": "session-update",
            "sessions": sessions
        }
        await self.broadcast_message(message)
        
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"Starting SyncAudio test server on port {self.port}")
        logger.info(f"Simulated latency: {self.simulated_latency}ms")
        
        async with serve(
            self.handle_client,
            "0.0.0.0",
            self.port,
            ping_interval=None,
            ping_timeout=None
        ):
            logger.info(f"Server listening on ws://0.0.0.0:{self.port}")
            await asyncio.Future()  # Run forever


def random_string(length: int = 4) -> str:
    """Generate a random string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def main():
    parser = argparse.ArgumentParser(description='SyncAudio Test WebSocket Server')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on')
    parser.add_argument('--latency', type=int, default=0, 
                        help='Simulated latency in milliseconds')
    parser.add_argument('--verbose', action='store_true', 
                        help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    server = SyncAudioTestServer(port=args.port, simulated_latency=args.latency)
    
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("Server shutting down...")


if __name__ == "__main__":
    main()
