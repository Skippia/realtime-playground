const chat = document.getElementById("chat");
const msgs = document.getElementById("msgs");
const presence = document.getElementById("presence-indicator");

// this will hold all the most recent messages
let allChat = [];

chat.addEventListener("submit", function (e) {
  e.preventDefault();
  postNewMsg(chat.elements.user.value, chat.elements.text.value);
  chat.elements.text.value = "";
});

async function postNewMsg(user, text) {
  await fetch("/msgs", {
    method: "POST",
    body: JSON.stringify({
      user,
      text,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

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

function render() {
  msgs.innerHTML = allChat.map(({ user, text, time, id }) =>
    `<li class="collection-item"><span class="badge">${user}</span>${text}</li>`
  ).join("\n");
}

getNewMsgs();
