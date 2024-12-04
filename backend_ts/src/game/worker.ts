import { Game } from '.';
import env from '../env';

const iterationTimeStepMs = env.ITERATION_TIME_STEP;
let intervalId: NodeJS.Timeout | undefined;

export function updateAllGames() {
  for (const game of Game.instances) {
    if (game.isRunning) {
      game.next();
    }
  }
}

export function start() {
  if (intervalId) {
    clearInterval(intervalId);
  }
  intervalId = setInterval(updateAllGames, iterationTimeStepMs);
}

export function stop() {
  clearInterval(intervalId);
  intervalId = undefined;
}