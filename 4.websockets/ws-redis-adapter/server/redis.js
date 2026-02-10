import redis from "redis";

const APPID = process.env.APPID;

const subscriber = redis.createClient({
  port: 6379,
  host: 'rds'
});

const publisher = redis.createClient({
  port: 6379,
  host: 'rds'
});

subscriber.on("subscribe", function (channel, count) {
  console.log(`Server ${APPID} subscribed successfully to livechat`)
  publisher.publish("livechat", "a message");
});

subscriber.on("message", function (channel, message) {
  try {
    console.log(`Server ${APPID} received message in channel ${channel} msg: ${message}`);
    connections.forEach(c => c.send(APPID + ":" + message))

  }
  catch (ex) {
    console.log("ERR::" + ex)
  }
});
