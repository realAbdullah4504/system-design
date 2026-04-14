import sessionService from "../services/session-service.js";
import logger from "../config/logger.js";

const sessionMiddleware = async (req, res, next) => {
  try {
    // Get session ID from cookies or Authorization header
    const sessionId = req.cookies?.sessionId || 
                     req.headers.authorization?.replace('Bearer ', '') ||
                     req.headers['x-session-id'];

    if (!sessionId) {
      req.session = null;
      return next();
    }

    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      req.session = null;
      return next();
    }

    req.session = session;
    req.user = session.user;
    
    next();
  } catch (error) {
    logger.error('Session middleware error', { error: error.message });
    req.session = null;
    next();
  }
};

export default sessionMiddleware;
