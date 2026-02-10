import express from 'express';
import { EventEmitter } from 'node:events';
import morgan from 'morgan'

const emitter = new EventEmitter();

const app = express()

app.use(morgan("dev"));
app.use(express.json());
app.use(express.static("frontend"));


app.get('/get-messages', (req, res) => {
    emitter.once('newMessage', (message) => {
        res.json(message)
    })
})

app.post('/new-messages', ((req, res) => {
    const message = req.body;
    emitter.emit('newMessage', message)
    res.status(200)
}))


app.listen(3000, () => console.log(`server started on port 3000`))
