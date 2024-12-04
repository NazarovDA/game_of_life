import { randomUUID } from "crypto";
import { WebSocketAPI } from "./wsServerAPI";

/** [y][x] */
export type GameGrid = Array<Array<boolean>>;

export interface GameObject {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  isRunning?: boolean;
  epoch?: bigint;
  currentState?: GameGrid;
}

export class Game extends WebSocketAPI {
  static instances: Game[] = [];
  static findById(id: string) {
    for (const game of this.instances) {
      if (game.id === id) return game;
    }
    return null;
  }

  id: string;
  name: string;
  x: number;
  y: number;
  isRunning: boolean;
  epoch: bigint;
  aliveCells: bigint;
  currentState: GameGrid;

  constructor() {
    super();
    this.id = randomUUID();
    Game.instances.push(this);
    this.name = '';
    this.x = 0;
    this.y = 0;
    this.epoch = 0n;
    this.aliveCells = 0n;
    this.isRunning = false;
    this.currentState = makeEmptyGrid(0, 0);
    this.initNetworking();
  }

  static fromObject(obj: GameObject) {
    const game = new Game();
    if (obj.id) game.id = obj.id;
    if (obj.name) game.name = obj.name;
    if (obj.epoch && obj.epoch > 0n) game.epoch = obj.epoch;
    if (typeof obj.isRunning === 'boolean') game.isRunning = obj.isRunning;
    if (obj.x !== undefined && obj.x > 0) game.x = obj.x;
    if (obj.y !== undefined && obj.y > 0) game.y = obj.y;
    
    if (obj.currentState) game.currentState = obj.currentState;
    else game.currentState = makeEmptyGrid(game.x, game.y);

    if (!game.isValid()) {
      console.warn('Invalid game object passed');
      game.isRunning = false;
    }
    return game;
  }

  isValid() {
    if (this.x <= 0 || this.y <= 0 || !this.id || !this.currentState) return false;
    if (this.currentState.length !== this.y) return false;
    for (let y = 0; y < this.y; y++) {
      if (this.currentState[y].length !== this.x) return false
    }
    return true;
  }

  start() {
    if (this.isValid()) {
      this.isRunning = true;
      this.notifyStart();
    }
  }
  stop() {
    this.isRunning = false;
    this.notifyStop();
  }

  next() {
    const [nextState, hasChanges, aliveCount] = nextEpoch(this.currentState);
    this.currentState = nextState;
    this.aliveCells = aliveCount;
    this.epoch++;
    this.notifyNextEpoch();
    if (!hasChanges) this.stop();
  }

  getCurrentStatePoints(flag = 0) {
    // TODO: flag
    const result: [x: number, y: number][] = [];

    for (let y = 0; y < this.y; y++) {
      for (let x = 0; x < this.x; x++) {
        if (this.currentState[y][x])
          result.push([x, y]);
      }
    }

    return result;
  }

  notifyStart() {
    this.sendMessage('sWorldStart', undefined);
  }
  notifyStop() {
    this.sendMessage('sWorldStop', undefined);
  }
  notifyNextEpoch() {
    const flag = 0; // TODO
    this.sendMessage('sWorldChange', {
      flag: flag,
      epoch: this.epoch,
      points: this.getCurrentStatePoints(flag),
    });
  }

  initNetworking() {
    this.on('cWorldStop', () => {
      this.stop();
    });

    this.on('cWorldStart', (_, socket) => {
      const previous = this.isRunning;
      this.start();

      if (this.isRunning === previous) {
        this.sendMessageDirect('sError', {
          msg: `Unable to start.`,
        }, socket);
      }
    });

    this.on('cWorldChange', (data, socket) => {
      // TODO: flag support
      if (this.isRunning) {
        this.sendMessageDirect('sError', {
          msg: `Simulation is running. Unable to process request`,
        }, socket);
        return;
      }

      const newGrid = makeEmptyGrid(this.x, this.y);
      let aliveCells = 0n;
      for (const [x, y] of data.points) {
        newGrid[y][x] = true;
        aliveCells++;
      }
      this.currentState = newGrid;
      this.aliveCells = aliveCells;

      // TODO: optimize this call
      this.notifyNextEpoch();
    });
  }

}



function countAliveNeighbors(grid: GameGrid, x: number, y: number): number {
  let aliveNeighbors = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const x2 = x + i;
      const y2 = y + j;
      if (
        !(i === 0 && j === 0) && // not "current" cell
        // bounds
        y2 >= 0 && y2 < grid.length &&
        x2 >= 0 && x2 < grid[0].length &&
        grid[y2][x2]
      ) {
        aliveNeighbors++;
      }
    }
  }
  return aliveNeighbors;
}

function nextEpoch(grid: GameGrid): [newGrid: GameGrid, hasChanges: boolean, aliveCount: bigint] {
  const h = grid.length;
  const w = grid[0].length;
  const nextGrid = makeEmptyGrid(w, h);
  let hasChanges = false;
  let aliveCount = 0n;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const aliveNeighbors = countAliveNeighbors(grid, x, y);

      if (grid[y][x]) { // alive
        if (aliveNeighbors === 2 || aliveNeighbors === 3) {
          nextGrid[y][x] = true;
          aliveCount++;
        } else {
          // under-population/over-population
          nextGrid[y][x] = false;
          hasChanges = true;
        }
      } else {
        if (aliveNeighbors === 3) {
          // reproduction
          nextGrid[y][x] = true;
          aliveCount++;
          hasChanges = true;
        }
      }
    }
  }

  return [nextGrid, hasChanges, aliveCount];
}

export function makeEmptyGrid(w: number, h: number): GameGrid {
  const grid = new Array(h);
  for (let y = 0; y < h; y++) {
    grid[y] = new Array(w).fill(false);
  }
  return grid;
}