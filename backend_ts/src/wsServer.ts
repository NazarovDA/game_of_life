import http from 'http';
import { Game } from './game';
import { WebSocketServer } from 'ws';

const worldsRoutePrefix = '/world/';
let wss: WebSocketServer;

export function getWebSocketServer() {
  return wss;
}

function getIdFromURL(url?: string) {
  const { pathname } = new URL(url || '', 'ws://base.url');
  if (pathname.startsWith(worldsRoutePrefix)) {
    const id = pathname.slice(worldsRoutePrefix.length);
    return id;
  }
  return null;
}

export function attachWebSocketServer(httpServer: http.Server) {
  wss = new WebSocketServer({ noServer: true });

  // wss.on('connection', (socket) => {
  //   const id = getIdFromURL(socket.url);
  //   console.log('conn', socket., id);
  //   if (!id) {
  //     socket.close();
  //     return;
  //   }
  //   const game = Game.findById(id);
  //   if (!game) {
  //     socket.close();
  //     return;
  //   }
  //   game.addClient(socket);
  // });

  httpServer.on('upgrade', (request, socket, head) => {
    const id = getIdFromURL(request.url);
    console.log('upgrade', id);
    if (!id) {
      socket.destroy();
      return;
    }

    const game = Game.findById(id);
    if (!game) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
      game.addClient(ws);
    });

    // alternative approach:
    // if (pathname === '/foo') {
    //   wss1.handleUpgrade(request, socket, head, function done(ws) {
    //     wss1.emit('connection', ws, request);
    //   });
    // } else if (pathname === '/bar') {
    //   wss2.handleUpgrade(request, socket, head, function done(ws) {
    //     wss2.emit('connection', ws, request);
    //   });
    // } else {
    //   socket.destroy();
    // }
  });
}