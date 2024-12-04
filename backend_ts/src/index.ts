import server from './server';
import { attachWebSocketServer } from './wsServer';
import * as worker from './game/worker';
import env from './env';

async function main() {
  const HOST = env.LISTEN_HOST;
  const PORT = env.LISTEN_PORT;
  // worker.start();
  const httpServer = server.listen(PORT, HOST, () => {
    console.log(`Listening: http://[${HOST}]:${PORT}`);
  });
  attachWebSocketServer(httpServer);

  worker.start();
}

main();
