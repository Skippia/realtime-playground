import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import configure from './routers/configure.js';

const app = express();
const port = 3000;

function onSocketPreError(e: Error) {
    console.log(e);
}

function onSocketPostError(e: Error) {
    console.log(e);
}

configure(app);

console.log(`Attempting to run server on port ${port}`);

const httpServer = app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

const wss = new WebSocketServer({ noServer: true });

// Authentication
httpServer.on('upgrade', (req, socket, head) => {
    console.log('uprgaded!')

    socket.on('error', onSocketPreError);

    // perform auth
    if (req.headers['BadAuth']) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        socket.removeListener('error', onSocketPreError);
        wss.emit('connection', ws, req);
    });
});

wss.on('connection', (ws, req) => {
    console.log('Connection established');

    ws.on('error', onSocketPostError);


    ws.on('message', (msg, isBinary) => {
        wss.clients.forEach((client) => {
            // Broadcast messages
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg, { binary: isBinary });
            }
            // Broadcast messages to all clients except the sender
            // if (client !== ws && client.readyState === WebSocket.OPEN) {
            //     client.send(msg, { binary: isBinary });
            // }
        });
    });

    ws.on('close', () => {
        console.log('Connection closed');
    });
});
