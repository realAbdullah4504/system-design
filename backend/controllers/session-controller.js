import sessionService from "../services/session-service.js";
import logger from "../config/logger.js";

class SessionController {
  async createSession(req, res) {
    try {
      const { user } = req.body;
      
      if (!user || !user.id) {
        return res.status(400).json({ error: 'User data with ID is required' });
      }

      const { sessionId, sessionData } = await sessionService.createSession(user);
      
      // Set session ID in cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000, // 1 hour
        sameSite: 'strict'
      });

      res.status(201).json({
        sessionId,
        user: sessionData.user,
        message: 'Session created successfully'
      });
    } catch (error) {
      logger.error('Create session error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const session = await sessionService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        sessionId: session.id,
        user: session.user,
        createdAt: session.createdAt,
        lastAccessed: session.lastAccessed
      });
    } catch (error) {
      logger.error('Get session error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const updates = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const session = await sessionService.updateSession(sessionId, updates);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        sessionId: session.id,
        user: session.user,
        message: 'Session updated successfully'
      });
    } catch (error) {
      logger.error('Update session error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const deleted = await sessionService.deleteSession(sessionId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Clear cookie
      res.clearCookie('sessionId');
      
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      logger.error('Delete session error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async refreshSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const refreshed = await sessionService.refreshSession(sessionId);
      
      if (!refreshed) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ message: 'Session refreshed successfully' });
    } catch (error) {
      logger.error('Refresh session error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new SessionController();
