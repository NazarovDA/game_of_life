package main

type GamePostReq struct {
	Name  string `json:"name"`
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Start bool   `json:"start,omitempty"`
}

type GamePostResponse struct {
	Id      string `json:"id,omitempty"`
	Success bool   `json:"ok"`
	Error   string `json:"error,omitempty"`
}
