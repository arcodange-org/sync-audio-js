// SyncAudio Server - Go Implementation
//
// A minimal WebSocket server for audio synchronization across multiple devices.
//
// Usage:
//   go run server.go [port]
//
// Example:
//   go run server.go 8080
//
// Then open http://localhost:8080 in your browser.
//
// Requirements:
//   go get github.com/gorilla/websocket
//   go get github.com/gorilla/mux

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket client
type Client struct {
	ID       string
	Socket   *websocket.Conn
	Role     string
	Alias    string
	Send     chan []byte
}

// Server holds the state of the application
type Server struct {
	Clients    map[string]*Client
	Master    string
	Broadcast chan []byte
	Upgrader  websocket.Upgrader
	Mutex     sync.RWMutex
}

// Message types
const (
	MessageTypeRole        = "role"
	MessageTypeSession     = "session-update"
	MessageTypeStart       = "start"
	MessageTypeStop        = "stop"
	MessageTypePause       = "pause"
	MessageTypeSetAlias    = "set-alias"
	MessageTypeSyncPing    = "sync-ping"
	MessageTypeSyncPong    = "sync-pong"
)

// SessionInfo represents a client session
type SessionInfo struct {
	ClientID string `json:"clientId"`
	Role     string `json:"role"`
	Alias    string `json:"alias"`
}

// SessionUpdateMessage represents a session update broadcast
type SessionUpdateMessage struct {
	Type      string        `json:"type"`
	Sessions  []SessionInfo `json:"sessions"`
	Timestamp int64         `json:"timestamp"`
}

// RoleMessage represents a role assignment
type RoleMessage struct {
	Type    string `json:"type"`
	Role    string `json:"role"`
	ClientID string `json:"clientId"`
}

// SyncPingMessage represents a clock sync ping
type SyncPingMessage struct {
	Type     string `json:"type"`
	RequestID string `json:"requestId"`
	T1        int64  `json:"T1"`
}

// SyncPongMessage represents a clock sync pong
type SyncPongMessage struct {
	Type     string `json:"type"`
	RequestID string `json:"requestId"`
	T1        int64  `json:"T1"`
	T4        int64  `json:"T4"`
}

// SetAliasMessage represents an alias update
type SetAliasMessage struct {
	Type  string `json:"type"`
	Alias string `json:"alias"`
}

// ControlMessage represents control commands
type ControlMessage struct {
	Type     string `json:"type"`
	StartTime int64  `json:"startTime,omitempty"`
}

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	}
)

func main() {
	port := "8080"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}

	server := NewServer()
	router := mux.NewRouter()

	// WebSocket endpoint
	router.HandleFunc("/", server.handleWebSocket)

	// Static files
	exampleDir := filepath.Join("..", "..", "example")
	router.PathPrefix("/").Handler(http.StripPrefix("/", http.FileServer(http.Dir(exampleDir))))

	// Start server
	addr := ":" + port
	fmt.Println("========================================")
	fmt.Println("  SyncAudio Server Running (Go)")
	fmt.Println("  HTTP:  http://localhost:", port)
	fmt.Println("  WS:    ws://localhost:", port)
	fmt.Println("  Example: http://localhost:", port, "/index.html")
	fmt.Println("========================================")

	log.Fatal(http.ListenAndServe(addr, router))
}

// NewServer creates a new server instance
func NewServer() *Server {
	return &Server{
		Clients:    make(map[string]*Client),
		Broadcast:  make(chan []byte),
		Upgrader:   upgrader,
	}
}

// handleWebSocket handles WebSocket connections
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	clientID := s.generateClientID()
	client := &Client{
		ID:     clientID,
		Socket: conn,
		Role:   "",
		Alias:  "",
		Send:   make(chan []byte, 256),
	}

	s.Mutex.Lock()
	s.Clients[clientID] = client

	// Assign role
	if s.Master == "" {
		s.Master = clientID
		client.Role = "master"
	} else {
		client.Role = "slave"
	}

	// Send role to client
	s.sendJSON(conn, RoleMessage{
		Type:    MessageTypeRole,
		Role:    client.Role,
		ClientID: clientID,
	})

	s.Mutex.Unlock()

	log.Printf("[%s] Client connected: %s (Total: %d)", time.Now().Format(time.RFC3339), clientID, len(s.Clients))

	// Start message handlers
	go s.readMessages(client)
	go s.writeMessages(client)
}

// readMessages reads messages from a client
func (s *Server) readMessages(client *Client) {
	defer func() {
		s.removeClient(client)
	}()

	for {
		_, message, err := client.Socket.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for %s: %v", client.ID, err)
			}
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("JSON decode error for %s: %v", client.ID, err)
			continue
		}

		messageType, ok := msg["type"].(string)
		if !ok {
			log.Printf("Invalid message type from %s", client.ID)
			continue
		}

		log.Printf("[%s] Received from %s: %s", time.Now().Format(time.RFC3339), client.ID, messageType)

		switch messageType {
		case MessageTypeSyncPing:
			// Handle clock sync ping
			if client.ID != s.Master {
				var pingMsg SyncPingMessage
				if err := json.Unmarshal(message, &pingMsg); err == nil {
					s.sendJSON(client.Socket, SyncPongMessage{
						Type:     MessageTypeSyncPong,
						RequestID: pingMsg.RequestID,
						T1:        pingMsg.T1,
						T4:        time.Now().UnixMilli(),
					})
				}
			}

		case MessageTypeStart, MessageTypeStop, MessageTypePause:
			// Forward control messages from master
			if client.ID == s.Master {
				s.broadcastControl(message, client.ID)
			}

		case MessageTypeSetAlias:
			// Update alias
			var aliasMsg SetAliasMessage
			if err := json.Unmarshal(message, &aliasMsg); err == nil {
				s.Mutex.Lock()
				client.Alias = aliasMsg.Alias
				s.Mutex.Unlock()
				s.broadcastSessionUpdate()
				log.Printf("[%s] Client %s set alias: %s", time.Now().Format(time.RFC3339), client.ID, aliasMsg.Alias)
			}

		default:
			log.Printf("Unknown message type: %s", messageType)
		}
	}
}

// writeMessages writes messages to a client
func (s *Server) writeMessages(client *Client) {
	defer client.Socket.Close()

	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				// Channel closed
				return
			}
			w, err := client.Socket.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}
		}
	}
}

// removeClient removes a client and cleans up
func (s *Server) removeClient(client *Client) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()

	if _, ok := s.Clients[client.ID]; ok {
		delete(s.Clients, client.ID)
		close(client.Send)
	}

	// Reassign master if needed
	if s.Master == client.ID {
		s.Master = ""
		if len(s.Clients) > 0 {
			// Pick a new master
			for id := range s.Clients {
				s.Master = id
				s.Clients[id].Role = "master"
				s.sendJSON(s.Clients[id].Socket, RoleMessage{
					Type:    MessageTypeRole,
					Role:    "master",
					ClientID: id,
				})
				break
			}
		}
	}

	log.Printf("[%s] Client disconnected: %s (Remaining: %d)", time.Now().Format(time.RFC3339), client.ID, len(s.Clients))
	s.broadcastSessionUpdate()
}

// broadcastSessionUpdate broadcasts the session list to all clients
func (s *Server) broadcastSessionUpdate() {
	s.Mutex.RLock()
	defer s.Mutex.RUnlock()

	sessions := make([]SessionInfo, 0, len(s.Clients))
	for id, client := range s.Clients {
		sessions = append(sessions, SessionInfo{
			ClientID: id,
			Role:     client.Role,
			Alias:    client.Alias,
		})
	}

	message := SessionUpdateMessage{
		Type:      MessageTypeSession,
		Sessions:  sessions,
		Timestamp: time.Now().UnixMilli(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Println("Error marshaling session update:", err)
		return
	}

	for id, client := range s.Clients {
		select {
		case client.Send <- data:
		default:
			// Channel full, skip
		}
	}
}

// broadcastControl broadcasts control messages from master to slaves
func (s *Server) broadcastControl(message []byte, senderID string) {
	s.Mutex.RLock()
	defer s.Mutex.RUnlock()

	if s.Master != senderID {
		return
	}

	for id, client := range s.Clients {
		if id != senderID {
			select {
			case client.Send <- message:
			default:
				// Channel full, skip
			}
		}
	}
}

// sendJSON sends a JSON message to a client
func (s *Server) sendJSON(conn *websocket.Conn, data interface{}) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshaling JSON:", err)
		return
	}
	conn.WriteMessage(websocket.TextMessage, jsonData)
}

// generateClientID generates a unique client ID
func (s *Server) generateClientID() string {
	rand.Seed(time.Now().UnixNano())
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return "client-" + string(b)
}
