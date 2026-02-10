import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { fileURLToPath } from "url";

export function onSocketPreError(e) {
  console.log(e);
}

export function onSocketPostError(e) {
  console.log(e);
}

export function handleStatic(app) {
  app.use(express.static(path.join(__dirname, '../client')))

  app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/index.html'));
  })
}

export function upgradeWsConnection(httpServer, wss) {
  httpServer.on('upgrade', (req, socket, head) => {
    console.log('upgraded!')

    socket.on('error', onSocketPreError);

    wss.handleUpgrade(req, socket, head, (ws) => {
      socket.removeListener('error', onSocketPreError);
      wss.emit('connection', ws, req)
    })
  });

}
