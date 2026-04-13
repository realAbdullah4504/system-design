import { redis } from "../config/redis.js";
import logger from "../config/logger.js";

class SessionReader {
  constructor() {
    this.sessionPrefix = "session:";
  }

  async getSession(sessionId) {
    try {
      if (!sessionId) {
        logger.warn('No sessionId provided for session reading');
        return null;
      }

      const sessionKey = this.sessionPrefix + sessionId;
      const sessionData = await redis.get(sessionKey);
      
      if (!sessionData) {
        logger.warn('Session not found', { sessionId });
        return null;
      }

      const session = JSON.parse(sessionData);
      logger.debug('Session retrieved successfully', { 
        sessionId, 
        userId: session.user?.id,
        lastAccessed: session.lastAccessed
      });
      
      return session;
    } catch (error) {
      logger.error('Error reading session', { sessionId, error: error.message });
      return null;
    }
  }

  async getSessionUser(sessionId) {
    const session = await this.getSession(sessionId);
    return session?.user || null;
  }

  async isSessionValid(sessionId) {
    const session = await this.getSession(sessionId);
    return !!session?.user;
  }

  async enrichMessageWithSession(messageBody, sessionId) {
    if (!sessionId) {
      return messageBody;
    }

    const user = await this.getSessionUser(sessionId);
    
    return {
      ...messageBody,
      sessionContext: {
        sessionId,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email
        } : null,
        timestamp: new Date().toISOString()
      }
    };
  }
}

export default new SessionReader();
