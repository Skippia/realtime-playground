import express from "express";
import Nanobuffer from "nanobuffer";
import morgan from "morgan";

const app = express();
const msg = new Nanobuffer(50);
const getMsgs = () => Array.from(msg).reverse();

app.use(morgan("dev"));
app.use(express.json());
app.use(express.static("frontend"));

app.get("/poll", function (req, res) {
  res.json({
    msg: getMsgs(),
  });
});

app.post("/poll", function (req, res) {
  const { user, text } = req.body;

  msg.push({
    user,
    text,
    time: Date.now(),
  });

  res.json({
    status: "ok",
  });
});

const port = process.env.PORT || 3000;
app.listen(port);
console.log(`listening on http://localhost:${port}`);
