import { redis } from "../config/redis.js";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger.js";

class SessionService {
  constructor() {
    this.sessionPrefix = "session:";
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  async createSession(userData, ttl = this.defaultTTL) {
    try {
      const sessionId = uuidv4();
      const sessionKey = this.sessionPrefix + sessionId;
      
      const sessionData = {
        id: sessionId,
        user: userData,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };

      await redis.setex(sessionKey, ttl, JSON.stringify(sessionData));
      
      logger.info('Session created', { sessionId, userId: userData.id });
      return { sessionId, sessionData };
    } catch (error) {
      logger.error('Error creating session', { error: error.message });
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const sessionKey = this.sessionPrefix + sessionId;
      const sessionData = await redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      session.lastAccessed = new Date().toISOString();
      
      // Update last accessed time
      await redis.setex(sessionKey, this.defaultTTL, JSON.stringify(session));
      
      return session;
    } catch (error) {
      logger.error('Error getting session', { sessionId, error: error.message });
      throw error;
    }
  }

  async updateSession(sessionId, updates) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return null;
      }

      const updatedSession = { ...session, ...updates };
      const sessionKey = this.sessionPrefix + sessionId;
      
      await redis.setex(sessionKey, this.defaultTTL, JSON.stringify(updatedSession));
      
      logger.info('Session updated', { sessionId });
      return updatedSession;
    } catch (error) {
      logger.error('Error updating session', { sessionId, error: error.message });
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      const sessionKey = this.sessionPrefix + sessionId;
      const result = await redis.del(sessionKey);
      
      logger.info('Session deleted', { sessionId, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Error deleting session', { sessionId, error: error.message });
      throw error;
    }
  }

  async refreshSession(sessionId, ttl = this.defaultTTL) {
    try {
      const sessionKey = this.sessionPrefix + sessionId;
      const exists = await redis.exists(sessionKey);
      
      if (!exists) {
        return false;
      }

      await redis.expire(sessionKey, ttl);
      
      logger.info('Session refreshed', { sessionId });
      return true;
    } catch (error) {
      logger.error('Error refreshing session', { sessionId, error: error.message });
      throw error;
    }
  }
}

export default new SessionService();
