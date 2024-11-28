package main

import (
	"encoding/binary"
	"fmt"
	"sync"
)

type GameProcess struct {
	x                 int
	y                 int
	isRunning         bool
	currentGeneration [][]bool
	lock              sync.Mutex
	currentEpoch      uint64
	reason            string
}

func (p *GameProcess) IsRunning() bool  { return p.isRunning }
func (p *GameProcess) GetEpoch() uint64 { return p.currentEpoch }
func (p *GameProcess) SetGeneration(generation [][]bool) {
	p.lock.Lock()
	defer p.lock.Unlock()
	p.currentGeneration = generation
}

func (p *GameProcess) StartGameProcess() {
	if p.isRunning {
		p.isRunning = true
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
				p.currentGeneration = append(p.currentGeneration, make([]bool, p.y))
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

func (p *GameProcess) runGame() {
	for p.isRunning {
		p.lock.Lock()
		err := p.nextGeneration()
		if err != nil {
			p.isRunning = false
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

	p.currentEpoch++

	return nil
}
func (p *GameProcess) logEpochToDB() {
}
