import express from 'express';
import { EventEmitter } from 'events';
import morgan from 'morgan'

const emitter = new EventEmitter();

const app = express()

app.use(morgan("dev"));
app.use(express.json());
app.use(express.static("frontend"));


app.get('/connect', (req, res) => {
  res.writeHead(200, {
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })

  emitter.on('newMessage', (message) => {
    res.write(`data: ${JSON.stringify(message)} \n\n`)
  })
})

app.post('/new-messages', ((req, res) => {
  const message = req.body;
  emitter.emit('newMessage', message)
  res.status(200)
}))


app.listen(3000, () => console.log(`server started on port 3000`))
