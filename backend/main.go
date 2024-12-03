package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	g "github.com/NazarovDA/game_of_life/game"
	"github.com/gorilla/websocket"
)

type GamePostReq struct {
	Name  string `json:"name"`
	X     uint32 `json:"x"`
	Y     uint32 `json:"y"`
	Start bool   `json:"start,omitempty"`
}

type GamePostResponse struct {
	Id      string `json:"id,omitempty"`
	Success bool   `json:"ok"`
	Error   string `json:"error,omitempty"`
}

var Games []*g.GameProcess

func PostWorld(w http.ResponseWriter, r *http.Request) {
	var body GamePostReq
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GamePostResponse{Error: err.Error(), Success: false})
		return
	}

	newGame := g.NewGame(body.Name, body.X, body.Y, body.Start)

	gameId := newGame.GetId()

	if gameId == "" {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GamePostResponse{Error: "Failed to create game", Success: false})
		return
	}

	Games = append(Games, newGame)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(GamePostResponse{
		Id:      gameId,
		Success: true,
	})
	go newGame.RunGame()
}

var upgrader = websocket.Upgrader{
	EnableCompression: true,
}

func WsHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	gameId := r.PathValue("id")

	for _, game := range Games {
		if game.GetId() == gameId {
			game.AddListener(ws)
			break
		}
	}
	defer func() {
		for _, game := range Games {
			if game.GetId() == gameId {
				game.RemoveListener(ws)
				break
			}
		}
	}()

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			log.Println(err)
			break
		}
		log.Printf("Received: %s", message)

		ws.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	}
}

func main() {
	http.HandleFunc("POST /world", PostWorld)
	http.HandleFunc("/world/{id}", WsHandler)

	log.Fatal(http.ListenAndServe(":8080", nil))
}
