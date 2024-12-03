package game

import (
	"encoding/binary"
	"fmt"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func NewGame(name string, x uint32, y uint32, isRunning bool) *GameProcess {
	field := make([][]bool, x)
	for i := range field {
		field[i] = make([]bool, y)
	}
	return &GameProcess{
		Id:                newId(),
		Name:              name,
		X:                 x,
		Y:                 y,
		IsRunning:         isRunning,
		currentGeneration: field,
	}
}

type GameProcess struct {
	Id                string `json:"id"`
	Name              string `json:"name"`
	X                 uint32 `json:"x"`
	Y                 uint32 `json:"y"`
	IsRunning         bool   `json:"isRunning"`
	currentGeneration [][]bool
	lock              sync.Mutex
	CurrentEpoch      uint64 `json:"epoch"`
	reason            string

	connectedSockets []*websocket.Conn
}

func (p *GameProcess) AddListener(l *websocket.Conn) {
	p.connectedSockets = append(p.connectedSockets, l)
}
func (p *GameProcess) RemoveListener(l *websocket.Conn) {
	for i, s := range p.connectedSockets {
		if s == l {
			p.connectedSockets = append(p.connectedSockets[:i], p.connectedSockets[i+1:]...)
			return
		}
	}
}
func (p *GameProcess) GetId() string    { return p.Id }
func (p *GameProcess) GetEpoch() uint64 { return p.CurrentEpoch }
func (p *GameProcess) SetGeneration(generation [][]bool) {
	p.lock.Lock()
	defer p.lock.Unlock()
	p.currentGeneration = generation
	log.Printf("%s:%d", p.Id, p.CurrentEpoch)
	for _, socket := range p.connectedSockets {
		var data []byte
		binary.LittleEndian.AppendUint16(data, 0x8002)                 // world state
		binary.LittleEndian.AppendUint64(data, uint64(p.CurrentEpoch)) // epoch
		data = append(data, 0)
		for rowI, row := range p.currentGeneration {
			for colI, col := range row {
				if col {
					binary.LittleEndian.AppendUint16(data, uint16(rowI))
					binary.LittleEndian.AppendUint16(data, uint16(colI))
				}
			}
		}
		err := socket.WriteMessage(websocket.BinaryMessage, data)
		if err != nil {
			fmt.Println("Error sending message:", err)
		}
	}
}

func (p *GameProcess) StartGameProcess() {
	if p.IsRunning {
		p.IsRunning = true
	}
}

func CreateFromBinaryData(data []byte) (*GameProcess, error) {
	if len(data)%8 != 0 {
		return nil, fmt.Errorf("invalid data length, must be a multiple of 8")
	}

	p := &GameProcess{}

	for i := 0; i < len(data); i += 8 {
		x := int(binary.BigEndian.Uint32(data[i : i+4]))
		y := int(binary.BigEndian.Uint32(data[i+4 : i+8]))

		if x >= len(p.currentGeneration) {
			for len(p.currentGeneration) <= x {
				p.currentGeneration = append(p.currentGeneration, make([]bool, p.Y))
			}
		}
		if y >= len(p.currentGeneration[x]) {
			for len(p.currentGeneration[x]) <= y {
				p.currentGeneration[x] = append(p.currentGeneration[x], false)
			}
		}
		p.currentGeneration[x][y] = true
	}

	p.reason = "Updated by WebSocket"

	return p, nil
}

func (p *GameProcess) RunGame() {
	for p.IsRunning {
		p.lock.Lock()
		err := p.nextGeneration()
		if err != nil {
			p.IsRunning = false
			p.reason = err.Error()
			return
		}
		p.lock.Unlock()
	}
}

func (p *GameProcess) nextGeneration() error {

	currentGrid := p.currentGeneration
	rows := len(currentGrid)
	cols := len(currentGrid[0])

	nextGrid := make([][]bool, rows)
	for i := range nextGrid {
		nextGrid[i] = make([]bool, cols)
	}

	countLiveNeighbors := func(row, col int) int {
		directions := [][2]int{
			{-1, -1}, {-1, 0}, {-1, 1},
			{0, -1}, {0, 1},
			{1, -1}, {1, 0}, {1, 1},
		}

		liveNeighbors := 0
		for _, direction := range directions {
			r, c := row+direction[0], col+direction[1]
			if r >= 0 && r < rows && c >= 0 && c < cols && currentGrid[r][c] {
				liveNeighbors++
			}
		}
		return liveNeighbors
	}

	for i := 0; i < rows; i++ {
		for j := 0; j < cols; j++ {
			liveNeighbors := countLiveNeighbors(i, j)

			if currentGrid[i][j] {
				if liveNeighbors == 2 || liveNeighbors == 3 {
					nextGrid[i][j] = true
				} else {
					nextGrid[i][j] = false
				}
			} else {
				if liveNeighbors == 3 {
					nextGrid[i][j] = true
				}
			}
		}
	}

	hasChanges := false
	allDead := true

	for i := 0; i < rows; i++ {
		for j := 0; j < cols; j++ {
			if currentGrid[i][j] != nextGrid[i][j] {
				hasChanges = true
			}
			if nextGrid[i][j] {
				allDead = false
			}
		}
	}

	if !hasChanges {
		return fmt.Errorf("deadlocked")
	}
	if allDead {
		return fmt.Errorf("all dead")
	}

	p.SetGeneration(nextGrid)

	p.CurrentEpoch++

	return nil
}

func (p *GameProcess) Start() {
	p.IsRunning = true
}
func (p *GameProcess) Stop() {
	p.IsRunning = false
}

func newId() string {
	val, err := uuid.NewV7()
	if err != nil {
		fmt.Println("Error generating UUID:", err)
		return ""
	}
	return val.String()
}
