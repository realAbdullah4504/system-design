import { subscriber } from "../config/redis.js";

export const subscribeToEvents = () => {
  subscriber.subscribe("events", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log(
        "[REDIS] Broadcasting message to SSE clients:",
        parsedMessage
      );
    } catch (err) {
      console.error("[REDIS] Error parsing message:", err);
    }
  });
};

export const listenToEvents = (clients) => {
  subscriber.on("message", (channel, message) => {
    try {
      const parsedMessage = JSON.parse(message);
      clients.forEach((client) => {
        client.res.write(`data: ${JSON.stringify(parsedMessage)}\n\n`);
      });
      console.log(
        "[REDIS] Broadcasting message to SSE clients:",
        parsedMessage
      );
    } catch (err) {
      console.error("[REDIS] Error parsing message:", err);
    }
  });
};
