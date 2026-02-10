## Idea
- We abuse here HTTP2. We artificially keep connections opened and as soon as we get new data, we write them into these connections

1. On each new connection from the client we save current connection into appropriate array `connections` at the server (via GET 'msgs' request to the server).
```js
// Client
async function* getChunksOfStream(utf8Decoder, reader) {
  while (true) {
    try {
      // It's resolved only when next chunk of data is ready to be read
      const { done, value } = await reader.read();

      if (done) return null;

      const chunk = utf8Decoder.decode(value, { stream: true });

      if (chunk === null) {
        break;
      }

      if (chunk) {
        yield chunk
      }
    } catch {
      return;
    }
  }
}

async function getNewMsgs() {
  try {
    const utf8Decoder = new TextDecoder("utf-8");
    const response = await fetch("/msgs");
    const reader = response.body.getReader();

    presence.innerText = "🟢";

    for await (const chunk of getChunksOfStream(utf8Decoder, reader)) {
      try {
        const json = JSON.parse(chunk);
        allChat = json.msg;
        render();
      } catch (e) {
        console.error("parse error", e);
      }
    }

    presence.innerText = "🔴";
  } catch (e) {
    console.error("connection error", e);
    presence.innerText = "🔴";
    throw e;
  }
}

// Server
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
```

2. Then on each POST 'msgs' request from the client we iterate on the server over the entire connection array and write into each of them new data gotten from client:
```js
  connections.forEach((stream) => {
      stream.write(JSON.stringify({ msg: getMsgs() }));
    });
```

## Misc
openssl req -new -newkey rsa:2048 -new -nodes -keyout key.pem -out csr.pem
openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out server.crt

[Both used by server]
// key.pem - private key. Is used to decrypt incoming data and encrypt outgoing data
// server.crt - public certificate. It's signed by private key (key.pem). Is sent to client during its trying to connect to the server

// csr.pem - public key. Certificate signing request (CSR). Contains info about server and public key that will be included in certificate. Is used by client to encrypt data before sending

