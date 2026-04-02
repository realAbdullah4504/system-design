import { subscriber } from "../config/redis.js";
import logger from "../config/logger.js";
import { trace, context, propagation } from "@opentelemetry/api";

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
    // Wrap entire handler in context
    const carrier = { traceparent: JSON.parse(message).traceparent };
    const ctx = propagation.extract(context.active(), carrier);
    
    context.with(ctx, () => {
      try {
        const parsedMessage = JSON.parse(message);
        const { traceparent, ...eventData } = parsedMessage;
        const clientCount = clients.size;
        
        const tracer = trace.getTracer('redis-events');
        const span = tracer.startSpan('listenToEvents');
        
        clients.forEach((client) => {
          client.res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        });
        
        span.setAttribute('clientCount', clientCount);
        span.setAttribute('channel', channel);
        span.end();
        
        logger.info('Broadcasting message to SSE clients', { 
          message: eventData, 
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
  });
};
