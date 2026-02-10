import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { handleStatic, upgradeWsConnection } from './helpers'

const connections = [];

const app = express();
const httpServer = app.listen(8080, () => console.log(`Listening on port 8080`));
const wss = new WebSocketServer({ noServer: true });

handleStatic(app)
upgradeWsConnection(httpServer, wss)

wss.on("connection", (ws, req) => {
  console.log('try to set connection...')

  ws.on('error', onSocketPostError);
  ws.on('open', () => {
    console.log('connection opened')
    connections.push(ws)

    debugger
  });
  ws.on('close', () => console.log('connection closed'));

  ws.on('message', function message(data) {
    console.log(`Received message ${data}`);
  });
  // ws.on('message', (msg, isBinary) => {
  //   wss.clients.forEach((client) => {
  //     // Broadcast messages
  //     if (client.readyState === WebSocket.OPEN) {
  //       client.send(msg, { binary: isBinary });
  //     }
  //     // Broadcast messages to all clients except the sender
  //     // if (client !== ws && client.readyState === WebSocket.OPEN) {
  //     //     client.send(msg, { binary: isBinary });
  //     // }
  //   });
  // });
})


subscriber.subscribe("livechat");
