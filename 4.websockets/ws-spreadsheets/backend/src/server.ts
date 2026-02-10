import { fileURLToPath } from "url";
import path from 'node:path'
import express from 'express'
import morgan from "morgan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express()

app.listen(3000, () => {
    console.log('Server started on 3000')
})

app.use(morgan("dev"));
// app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'))
})
