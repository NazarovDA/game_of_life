package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func PostWorld(w http.ResponseWriter, r *http.Request) {
	var body GamePostReq
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GamePostResponse{Error: err.Error(), Success: false})
		return
	}

}

func main() {

	http.HandleFunc("POST /world", PostWorld)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
