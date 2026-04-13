import { publishJobEvent } from "../services/sns.js";
import logger from "../config/logger.js";

class EventController {
  async getAllEvents(req, res) {
    try {
      logger.info('Fetching all events');
      const events = await Event.find().sort({ createdAt: -1 });
      logger.info('Events fetched successfully', { count: events.length });
      res.json(events);
    } catch (err) {
      logger.error('Error fetching events', { error: err.message, stack: err.stack });
      res.status(500).json({ error: "Error fetching events" });
    }
  }

  async sendEvent(req, res) {
    const { type, payload } = req.body;

    logger.info('Received event request', { type, payload });

    if (!type || !payload) {
      logger.warn('Missing required fields', { type, payload });
      return res.status(400).json({ error: "type and payload are required" });
    }

    try {
      logger.info('Publishing to SNS', { topicArn: process.env.TOPIC_ARN, type });
      await publishJobEvent({ type, payload });
      logger.info('Successfully published to SNS', { type });

      res.json({
        message: "Event sent successfully",
        type: type,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Failed to publish to SNS', { error: err.message, stack: err.stack, type });
      res.status(500).json({ error: "Failed to send event" });
    }
  }

  async getEventStream(req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    const clientId = Date.now();
    const client = { id: clientId, res };
    
    // Store client reference for streaming
    req.app.locals.eventClients = req.app.locals.eventClients || new Map();
    req.app.locals.eventClients.set(clientId, client);
    
    logger.info('SSE client connected', { clientId });

    // Initial handshake
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        instance: process.env.HOSTNAME,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Heartbeat (important for ALB/ECS)
    const heartbeat = setInterval(() => {
      res.write(":\n\n"); // keep connection alive
    }, 25000);

    req.on("close", () => {
      logger.info('SSE client disconnected', { clientId });
      clearInterval(heartbeat);
      req.app.locals.eventClients.delete(clientId);
    });
  }
}

export default new EventController();
