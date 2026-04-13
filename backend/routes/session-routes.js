import express from 'express';
import sessionController from '../controllers/session-controller.js';
import sessionMiddleware from '../middleware/session-middleware.js';

const router = express.Router();

// Create session
router.post('/sessions', sessionController.createSession.bind(sessionController));

// Get session
router.get('/sessions/:sessionId', sessionController.getSession.bind(sessionController));

// Update session
router.put('/sessions/:sessionId', sessionController.updateSession.bind(sessionController));

// Delete session
router.delete('/sessions/:sessionId', sessionController.deleteSession.bind(sessionController));

// Refresh session
router.post('/sessions/:sessionId/refresh', sessionController.refreshSession.bind(sessionController));

// Get current session (requires session middleware)
router.get('/current', sessionMiddleware, (req, res) => {
  if (!req.session) {
    return res.status(401).json({ error: 'No active session' });
  }
  
  res.json({
    sessionId: req.session.id,
    user: req.session.user,
    lastAccessed: req.session.lastAccessed
  });
});

export default router;
