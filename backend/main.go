package main

import (
	"encoding/binary"
	"encoding/json"
	"log"
	"net/http"
	"time"

	g "github.com/NazarovDA/game_of_life/game"
	"github.com/gorilla/mux"
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

type GetResponse struct {
	Items []*g.GameProcess `json:"items"`
	Ok    bool             `json:"ok"`
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
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func WsHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	log.Println("EBAT")
	defer ws.Close()

	vars := mux.Vars(r)
	gameId := vars["id"]

	log.Println(gameId)

	var currentGame *g.GameProcess

	for _, game := range Games {
		if game.GetId() == gameId {
			game.AddListener(ws)
			currentGame = game
			log.Println(game.Id)
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
		log.Printf("Received: %x", message)

		if binary.LittleEndian.Uint16(message) == 0x0000 {
			currentGame.Stop()
			ws.WriteMessage(websocket.BinaryMessage, binary.LittleEndian.AppendUint16([]byte{}, 0x8000))
			continue
		}

		if binary.LittleEndian.Uint16(message) == 0x0001 {
			currentGame.Start()
			ws.WriteMessage(websocket.BinaryMessage, binary.LittleEndian.AppendUint16([]byte{}, 0x8001))
			continue
		}

		if binary.LittleEndian.Uint16(message) == 0x0002 {
			// TODO: flag
			game, err := g.CreateFromBinaryData(message[3:])
			if err != nil {
				data := binary.LittleEndian.AppendUint16([]byte{}, 0x88ff)
				jsonerror, _ := json.Marshal(err.Error())
				log.Println(err)
				data = append(data, jsonerror...)

				ws.WriteMessage(websocket.BinaryMessage, data)
				continue
			}
			Games = append(Games, game)
			game.AddListener(ws)
			go game.RunGame()
		}

		ws.SetReadDeadline(time.Now().Add(60000 * time.Millisecond))
	}
}

func headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Access-Control-Allow-Origin", "*")
		w.Header().Add("Access-Control-Allow-Methods", "GET, POST, PUT")
		w.Header().Add("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Add("Access-Control-Max-Age", "86400")
		w.Header().Add("Access-Control-Allow-Credentials", "true")
		log.Println(r.RequestURI)
		log.Println(r.URL)
		next.ServeHTTP(w, r)
	})
}

func main() {
	Games = make([]*g.GameProcess, 0)
	r := mux.NewRouter()
	r.Use(headers)
	r.HandleFunc("/world", PostWorld).Methods("POST")
	r.HandleFunc("/world", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(GetResponse{
			Items: Games,
			Ok:    true,
		})
	}).Methods("GET")
	r.HandleFunc("/world", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}).Methods("OPTIONS")
	r.HandleFunc("/world/{id}", WsHandler)

	log.Fatal(http.ListenAndServe(":8080", r))
}
