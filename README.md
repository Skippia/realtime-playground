# Realtime Playground

Коллекция из 7 реализаций real-time коммуникации в вебе — от наивного polling до WebSocket с горизонтальным масштабированием через Redis. Каждый пример — рабочий мини-чат, демонстрирующий конкретный подход с минимальным кодом.

Цель — показать эволюцию подходов и trade-offs каждого из них на практике.

## Содержание

- [Обзор подходов](#обзор-подходов)
- [Требования](#требования)
- [1. Short Polling](#1-short-polling)
- [2. Long Polling](#2-long-polling)
- [3. Server-Sent Events (SSE)](#3-server-sent-events-sse)
- [4. HTTP/2 Stream Abuse](#4-http2-stream-abuse)
- [5. WebSocket (базовый)](#5-websocket-базовый)
- [6. WebSocket + Redis Adapter](#6-websocket--redis-adapter)
- [7. WebSocket + Vue 3 (Spreadsheets)](#7-websocket--vue-3-spreadsheets)
- [Сравнительная таблица](#сравнительная-таблица)
- [Когда что использовать](#когда-что-использовать)

## Обзор подходов

| # | Подход | Направление | Latency | Сложность | Масштабируемость |
|---|--------|-------------|---------|-----------|-----------------|
| 1 | Short Polling | client → server | высокая (интервал 3с) | низкая | ✅ stateless |
| 2 | Long Polling | client → server (удержание) | средняя | низкая | ⚠️ open connections |
| 3 | SSE | server → client | низкая | низкая | ⚠️ 6 conn/domain |
| 4 | HTTP/2 Streams | server → client | низкая | средняя | ✅ мультиплексирование |
| 5 | WebSocket | двунаправленная | низкая | средняя | ❌ stateful |
| 6 | WS + Redis | двунаправленная | низкая | высокая | ✅ горизонтально |
| 7 | WS + Vue 3 | двунаправленная | низкая | высокая | ❌ stateful |

## Требования

- **Node.js** >= 18
- **npm** или **pnpm**
- **Docker** и **Docker Compose** — только для примера #6 (WS + Redis)
- Для HTTP/2 примера — браузер с поддержкой HTTP/2 (все современные)

---

## 1. Short Polling

📁 `1.polling/short-pulling/`

Клиент периодически дёргает сервер через `GET /poll`. Самый простой и самый расточительный способ.

### Принцип работы

```
Client                          Server
  |                               |
  |--- GET /poll ---------------->|
  |<-- [{user, text, time}] ------|
  |                               |
  |   ...ждём 3 секунды...        |
  |                               |
  |--- GET /poll ---------------->|
  |<-- [{user, text, time}] ------|
```

### Архитектура

**Сервер** хранит последние 50 сообщений в кольцевом буфере (`Nanobuffer`). Два endpoint-а: `GET /poll` отдаёт все сообщения, `POST /poll` добавляет новое.

**Клиент** использует `requestAnimationFrame` вместо `setInterval` — таймер автоматически останавливается, когда вкладка неактивна.

### Ключевые фрагменты

Серверный endpoint — тривиальный JSON-ответ:

```js
// backend/server.js
const msg = new Nanobuffer(50);

app.get("/poll", function (req, res) {
  res.json({ msg: Array.from(msg).reverse() });
});
```

RAF-таймер на клиенте (polling каждые 3 секунды):

```js
// frontend/polling-chat.js
const INTERVAL = 3000;
let timeToMakeNextRequest = 0;

function rafTimer(time) {
  if (timeToMakeNextRequest <= time) {
    getNewMsgs();
    timeToMakeNextRequest = time + INTERVAL;
  }
  requestAnimationFrame(rafTimer);
}

requestAnimationFrame(rafTimer);
```

### Запуск

```bash
cd 1.polling/short-pulling
npm install
npm run dev    # nodemon, порт 3000
```

Открыть `http://localhost:3000`

### Плюсы / минусы

✅ Максимально просто в реализации
✅ Работает через любой proxy/firewall
✅ RAF экономит ресурсы при неактивной вкладке

❌ Постоянная нагрузка на сервер, даже если нет новых сообщений
❌ Задержка доставки = интервал polling (3с)
❌ Трафик растёт линейно с числом клиентов

---

## 2. Long Polling

📁 `1.polling/long-pulling/`

Клиент отправляет запрос и сервер **удерживает соединение**, пока не появится новое сообщение. Как только ответ получен — клиент сразу отправляет следующий запрос.

### Принцип работы

```
Client                          Server
  |                               |
  |--- GET /get-messages -------->|
  |         (ждём...)             |  <-- emitter.once('newMessage')
  |                               |
  |    ...кто-то шлёт POST...     |  --> emitter.emit('newMessage')
  |                               |
  |<-- {message, id} -------------|
  |                               |
  |--- GET /get-messages -------->|  <-- рекурсивный вызов
  |         (ждём...)             |
```

### Архитектура

Сервер использует `EventEmitter` с `.once()` — каждый подключённый клиент ждёт ровно одно событие, после чего соединение закрывается. Клиент рекурсивно вызывает `subscribe()` после каждого полученного сообщения.

### Ключевые фрагменты

Удержание соединения через `emitter.once`:

```js
// backend/server.js
const emitter = new EventEmitter();

app.get('/get-messages', (req, res) => {
  emitter.once('newMessage', (message) => {
    res.json(message);
  });
});

app.post('/new-messages', (req, res) => {
  emitter.emit('newMessage', req.body);
  res.status(200);
});
```

Рекурсивная подписка на клиенте:

```js
// frontend/long-pulling-chat.js
async function subscribe() {
  try {
    const response = await fetch('/get-messages');
    const data = await response.json();
    messages.unshift(data);
    renderMessages();
    await subscribe(); // ← рекурсия
  } catch (e) {
    setTimeout(() => subscribe(), 500); // back-off при ошибке
  }
}
```

### Запуск

```bash
cd 1.polling/long-pulling
npm install
npm run dev    # nodemon, порт 3000
```

Открыть `http://localhost:3000`

### Плюсы / минусы

✅ Мгновенная доставка (в пределах round-trip)
✅ Нет лишних запросов, когда нечего отправлять
✅ Работает через любой proxy/firewall

❌ Каждый клиент держит открытое TCP-соединение
❌ Пропуск сообщений, если два события произошли между запросами
❌ Таймауты на proxy и load balancer могут обрывать соединение

---

## 3. Server-Sent Events (SSE)

📁 `2.server-sent-events/`

Сервер держит открытое соединение и пушит данные через `text/event-stream`. Клиент использует нативный `EventSource` API.

### Принцип работы

```
Client                          Server
  |                               |
  |--- GET /connect ------------->|
  |<== Connection: keep-alive ====|  (Content-Type: text/event-stream)
  |                               |
  |<-- data: {message} -------=---|  ← res.write()
  |<-- data: {message} -------=---|  ← res.write()
  |<-- data: {message} -------=---|  ← непрерывный поток
```

### Архитектура

Сервер отвечает с заголовками `text/event-stream` и `Connection: keep-alive`. Каждое новое сообщение пишется в тот же response через `res.write()`. `EventEmitter` используется как шина между `POST /new-messages` и всеми подключёнными SSE-стримами.

### Ключевые фрагменты

Серверный SSE-endpoint:

```js
// backend/server.js
app.get('/connect', (req, res) => {
  res.writeHead(200, {
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  emitter.on('newMessage', (message) => {
    res.write(`data: ${JSON.stringify(message)} \n\n`);
  });
});
```

Клиент с `EventSource`:

```js
// frontend/server-sent-events-chat.js
function subscribe() {
  const eventSource = new EventSource('/connect');

  eventSource.onmessage = (event) => {
    const message = JSON.parse(event.data);
    messages.unshift(message);
    renderMessages();
  };
}
```

### Запуск

```bash
cd 2.server-sent-events
npm install
npm run dev    # nodemon, порт 3000
```

Открыть `http://localhost:3000`

### Плюсы / минусы

✅ Нативный API браузера (`EventSource`), автопереподключение из коробки
✅ Простой протокол, легко дебажить (plain text)
✅ Эффективнее long polling — одно соединение на весь сеанс

❌ Только server → client (для отправки нужен отдельный `POST`)
❌ Ограничение в 6 соединений на домен в HTTP/1.1
❌ Нет бинарных данных

---

## 4. HTTP/2 Stream Abuse

📁 `3.http-2-multiplexing-abuse/`

Эксперимент: используем мультиплексирование HTTP/2 не по назначению. Сервер держит открытый HTTP/2 stream и пишет в него данные при каждом новом сообщении. Клиент читает stream через `ReadableStream` API.

### Принцип работы

```
Client                             Server (HTTP/2)
  |                                  |
  |=== HTTP/2 stream (GET /msgs) ===>|
  |<== stream.respond(200) ========= |
  |<-- stream.write(JSON) ---------- |  ← начальные данные
  |                                  |
  |    ...кто-то POST /msgs...       |
  |                                  |
  |<-- stream.write(JSON) ---------- |  ← broadcast по всем connections
  |<-- stream.write(JSON) ---------- |
```

### Архитектура

Сервер создаётся через `http2.createSecureServer()` (HTTP/2 требует TLS). При `GET /msgs` сервер отвечает `200 OK`, но не закрывает stream — сохраняет его в массив `connections`. При новом POST пишет обновлённый массив сообщений во все открытые streams.

Клиент использует `fetch()` + `response.body.getReader()` и async generator для чтения chunks по мере их поступления.

### Ключевые фрагменты

HTTP/2 stream — сервер держит соединение открытым:

```js
// backend/server.js
server.on("stream", (stream, headers) => {
  if (path === "/msgs" && method === "GET") {
    stream.respond({ ":status": 200, "content-type": "text/plain; charset=utf-8" });
    stream.write(JSON.stringify({ msg: getMsgs() }));
    connections.push(stream);

    stream.on("close", () => {
      connections = connections.filter((s) => s !== stream);
    });
  }
});
```

Async generator для чтения stream на клиенте:

```js
// frontend/http2-chat.js
async function* getChunksOfStream(utf8Decoder, reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) return null;
    const chunk = utf8Decoder.decode(value, { stream: true });
    if (chunk) yield chunk;
  }
}

async function getNewMsgs() {
  const response = await fetch("/msgs");
  const reader = response.body.getReader();

  for await (const chunk of getChunksOfStream(utf8Decoder, reader)) {
    const json = JSON.parse(chunk);
    allChat = json.msg;
    render();
  }
}
```

### Особенности

- HTTP/2 **обязательно** требует HTTPS — в проекте используются самоподписанные сертификаты (`server.crt`, `key.pem`)
- Браузер может попросить подтвердить исключение безопасности
- Это **не** стандартное использование HTTP/2 — скорее proof of concept

### Запуск

```bash
cd 3.http-2-multiplexing-abuse
npm install
npm run server    # nodemon, порт 8080 (HTTPS)
```

Открыть `https://localhost:8080` (именно httpS!)

### Плюсы / минусы

✅ Нет ограничения на 6 соединений (HTTP/2 мультиплексирует)
✅ Бинарный фрейминг, сжатие заголовков
✅ Работает без WebSocket

❌ Требует HTTPS/TLS
❌ Не предназначен для этого — нестандартное поведение
❌ Нет встроенного механизма переподключения
❌ Сложнее дебажить

---

## 5. WebSocket (базовый)

📁 `4.websockets/ws-example/`

Полноценный двунаправленный канал по протоколу WebSocket. Сервер на `ws`, интеграция через `noServer` + HTTP upgrade.

### Принцип работы

```
Client                          Server
  |                               |
  |--- HTTP Upgrade: websocket -->|
  |<== 101 Switching Protocols ===|
  |                               |
  |<== полный дуплекс ============|
  |--- send(msg) ---------------->|
  |<-- broadcast(msg) -----------=|  ← wss.clients.forEach()
```

### Архитектура

Express HTTP-сервер обрабатывает `upgrade` event вручную — это позволяет добавить аутентификацию до создания WebSocket соединения. `WebSocketServer` работает в режиме `noServer: true`. Broadcast идёт через `wss.clients`.

### Ключевые фрагменты

Upgrade handler с проверкой авторизации:

```js
// backend/server.ts
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
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
```

Broadcast всем клиентам:

```js
wss.on('connection', (ws, req) => {
  ws.on('message', (msg, isBinary) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg, { binary: isBinary });
      }
    });
  });
});
```

### Запуск

```bash
cd 4.websockets/ws-example
npm install
npm start    # build + node, порт 3000
```

Открыть `http://localhost:3000`

### Плюсы / минусы

✅ Настоящий full-duplex — обе стороны могут слать данные когда угодно
✅ Минимальный overhead после handshake (2-6 байт на фрейм)
✅ Поддержка бинарных данных
✅ Низкая latency

❌ Не масштабируется горизонтально из коробки (state привязан к процессу)
❌ Stateful — усложняет деплой (sticky sessions, etc.)
❌ Некоторые proxy/firewall блокируют WebSocket

---

## 6. WebSocket + Redis Adapter

📁 `4.websockets/ws-redis-adapter/`

Горизонтальное масштабирование WebSocket через Redis pub/sub. Несколько WS-серверов за HAProxy, синхронизированных через общий Redis.

### Принцип работы

```
                    ┌─────────────┐
                    │   HAProxy   │  :8080
                    │ (балансер)  │
                    └──────┬──────┘
                   ┌───────┴───────┐
                   │               │
            ┌──────┴──────┐ ┌──────┴──────┐
            │  ws1 (:8080)│ │  ws2 (:8080)│
            │  APPID=1111 │ │  APPID=2222 │
            └──────┬──────┘ └──────┬──────┘
                   │               │
                   └───────┬───────┘
                    ┌──────┴──────┐
                    │    Redis    │  :6379
                    │  pub/sub    │
                    └─────────────┘
```

Когда сообщение приходит на ws1, оно публикуется в Redis-канал `livechat`. Все WS-серверы подписаны на этот канал и рассылают сообщение своим локальным клиентам.

### Архитектура

- **HAProxy** — балансировщик на порту 8080, раскидывает клиентов по ws-серверам
- **ws1, ws2, ...** — одинаковые Node.js WS-серверы, различаются только `APPID`
- **Redis** — шина сообщений через pub/sub, канал `livechat`

### Docker Compose

```yaml
# docker-compose.yml
services:
  lb:
    image: haproxy
    ports:
      - "8080:8080"
    volumes:
      - ./haproxy:/usr/local/etc/haproxy

  ws1:
    build: .
    environment:
      - APPID=1111
    command: ["npm", "run", "start"]

  ws2:
    build: .
    environment:
      - APPID=2222

  rds:
    image: redis
```

HAProxy конфиг (`haproxy/haproxy.cfg`):

```
frontend http
    bind *:8080
    mode http
    timeout client 1000s
    use_backend all

backend all
    mode http
    timeout server 1000s
    timeout connect 1000s
    server s1 ws1:8080
    server s2 ws2:8080
```

### Ключевые фрагменты

Redis pub/sub — подписка и рассылка:

```js
// server/redis.js
const subscriber = redis.createClient({ port: 6379, host: 'rds' });
const publisher  = redis.createClient({ port: 6379, host: 'rds' });

subscriber.on("message", function (channel, message) {
  connections.forEach(c => c.send(APPID + ":" + message));
});
```

### Запуск

```bash
cd 4.websockets/ws-redis-adapter
docker compose up --build
```

Открыть `http://localhost:8080`

### Плюсы / минусы

✅ Горизонтальное масштабирование — добавляй серверы по мере роста
✅ Каждый сервер независим, Redis — единственная точка синхронизации
✅ Стандартный паттерн для production WebSocket

❌ Redis — single point of failure (нужен кластер для HA)
❌ Дополнительный hop через Redis увеличивает latency
❌ Сложность инфраструктуры: Docker, HAProxy, Redis

---

## 7. WebSocket + Vue 3 (Spreadsheets)

📁 `4.websockets/ws-spreadsheets/`

Скелет collaborative spreadsheet приложения. Backend на Express + WS, frontend на Vue 3 с Vite.

### Стек

- **Backend**: Express, ws, TypeScript, tsx
- **Frontend**: Vue 3, Vite, Pinia, Vue Router, TypeScript

### Запуск

Backend:

```bash
cd 4.websockets/ws-spreadsheets/backend
npm install
npm run dev    # tsx watch, порт 3000
```

Frontend:

```bash
cd 4.websockets/ws-spreadsheets/ws-spreasheets
npm install
npm run dev    # vite dev server
```

---

## Сравнительная таблица

| Подход | Протокол | Направление | Latency | Overhead | Сложность | Масштабируемость | Browser Support |
|--------|----------|-------------|---------|----------|-----------|-----------------|-----------------|
| Short Polling | HTTP/1.1 | half-duplex | ~3с (интервал) | высокий | низкая | ✅ stateless | все |
| Long Polling | HTTP/1.1 | half-duplex | ~RTT | средний | низкая | ⚠️ open connections | все |
| SSE | HTTP/1.1 | server → client | низкая | низкий | низкая | ⚠️ 6 conn/domain | все (кроме IE) |
| HTTP/2 Streams | HTTP/2 | server → client | низкая | низкий | средняя | ✅ мультиплексирование | все современные |
| WebSocket | WS | full-duplex | низкая | минимальный | средняя | ❌ stateful | все |
| WS + Redis | WS + Redis | full-duplex | низкая | минимальный | высокая | ✅ горизонтально | все |
| WS + Vue 3 | WS | full-duplex | низкая | минимальный | высокая | ❌ stateful | все |

## Когда что использовать

**Short Polling** — когда данные обновляются редко и задержка в несколько секунд приемлема. Dashboard-ы, которые обновляются раз в минуту. Или если инфраструктура не позволяет ничего другого.

**Long Polling** — когда нужна быстрая доставка, но WebSocket/SSE недоступны (корпоративные proxy, ограничения firewall). Fallback-стратегия.

**SSE** — уведомления, ленты новостей, логи в реальном времени — всё, где сервер пушит, а клиент только слушает. Идеально для server-initiated events.

**HTTP/2 Streams** — proof of concept. На практике SSE или WebSocket удобнее. Но если уже есть HTTP/2 и нужен server push без дополнительных протоколов — можно рассмотреть.

**WebSocket** — чаты, игры, collaborative editing, трейдинг — всё, где обе стороны активно обмениваются данными с минимальной задержкой.

**WS + Redis** — production WebSocket, когда один сервер не справляется. Любой сценарий из предыдущего пункта, но с требованием горизонтального масштабирования.
