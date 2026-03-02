import { subscriber } from "../config/redis.js";
import logger from "../config/logger.js";

export const subscribeToEvents = () => {
  subscriber.subscribe("events", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      logger.info('Redis subscription message received', { message: parsedMessage, channel: 'events' });
    } catch (err) {
      logger.error('Error parsing Redis subscription message', { error: err.message, rawMessage: message });
    }
  });
};

export const listenToEvents = (clients) => {
  subscriber.on("message", (channel, message) => {
    try {
      const parsedMessage = JSON.parse(message);
      const clientCount = clients.size;
      
      clients.forEach((client) => {
        client.res.write(`data: ${JSON.stringify(parsedMessage)}\n\n`);
      });
      
      logger.info('Broadcasting message to SSE clients', { 
        message: parsedMessage, 
        channel,
        clientCount,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('Error parsing Redis message for SSE broadcast', { 
        error: err.message, 
        rawMessage: message,
        channel
      });
    }
  });
};
