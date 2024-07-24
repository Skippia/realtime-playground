import http2 from "http2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";
import Nanobuffer from "nanobuffer";

let connections = [];

const msg = new Nanobuffer(50);
const getMsgs = () => Array.from(msg).reverse();


// http2 only works over HTTPS
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = http2.createSecureServer({
  cert: fs.readFileSync(path.join(__dirname, "/../server.crt")),
  key: fs.readFileSync(path.join(__dirname, "/../key.pem")),
});

const { HTTP2_HEADER_PATH, HTTP2_HEADER_METHOD, HTTP2_HEADER_STATUS } = http2.constants;

server.on("stream", (stream, headers) => {
  const method = headers[HTTP2_HEADER_METHOD];
  const path = headers[HTTP2_HEADER_PATH];

  // streams will open for everything, we want just GETs on /msgs
  if (path === "/msgs" && method === "GET") {
    // immediately respond with 200 OK and encoding
    stream.respond({
      ":status": 200,
      "content-type": "text/plain; charset=utf-8",
    });

    // write the first response
    stream.write(JSON.stringify({ msg: getMsgs() }));

    // keep track of the connection
    connections.push(stream);

    // when the connection closes, stop keeping track of it
    stream.on("close", () => {
      connections = connections.filter((s) => s !== stream);
    });
  }
});

server.on("request", async (req, res) => {
  const _path = req.headers[HTTP2_HEADER_PATH];
  const _method = req.headers[HTTP2_HEADER_METHOD];

  if (_path !== "/msgs") {
    // handle the static assets
    return handler(req, res, {
      public: path.join(__dirname, '../frontend'),
    });

  } else if (_method === "POST") {
    // get data out of post
    const buffers = [];

    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const data = Buffer.concat(buffers).toString();
    const { user, text } = JSON.parse(data);

    msg.push({
      user,
      text,
      time: Date.now(),
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
    })
    res.end();

    // notify all connected users
    connections.forEach((stream) => {
      stream.write(JSON.stringify({ msg: getMsgs() }));
    });
  }
});

server.listen(8080, () =>
  console.log(
    `Server running at https://localhost:8080 - make sure you're on httpS, not http`
  )
);
