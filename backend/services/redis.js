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

export const listenToEvents = (app) => {
  subscriber.on("message", (channel, message) => {
    const carrier = { traceparent: JSON.parse(message).traceparent };
    const ctx = propagation.extract(context.active(), carrier);

    context.with(ctx, () => {
      const tracer = trace.getTracer('redis-events');
      const span = tracer.startSpan('listenToEvents');

      try {
        const parsedMessage = JSON.parse(message);
        const { traceparent, ...eventData } = parsedMessage;

        // 🔥 INTENTIONAL ERROR TRIGGER
        if (eventData.triggerError) {
          throw new Error("🔥 Manual test error triggered");
        }

        const clientCount = app.locals.eventClients.size;

        app.locals.eventClients.forEach((client) => {
          client.res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        });

        span.setAttribute('clientCount', clientCount);
        span.setAttribute('channel', channel);

        logger.info('Broadcasting message to SSE clients', {
          message: eventData,
          channel,
          clientCount,
          timestamp: new Date().toISOString()
        });

      } catch (err) {
        // 🔴 Record error in span (VERY IMPORTANT)
        span.recordException(err);
        span.setStatus({ code: 2, message: err.message }); // 2 = ERROR

        logger.error('Error parsing Redis message for SSE broadcast', {
          error: err.message,
          rawMessage: message,
          channel
        });

      } finally {
        span.end();
      }
    });
  });
};
