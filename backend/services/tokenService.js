const { v4: uuidv4 } = require('uuid');
const redis = require('../queue/redis');

class TokenService {
  // Generate and store a new token
  static async generateToken(expiresIn = 300) { // 5 minutes default
    const token = uuidv4();
    const key = `token:${token}`;
    
    await redis.setex(key, expiresIn, '1');
    
    return {
      token,
      expiresIn,
      key
    };
  }

  // Validate and consume token (atomic operation)
  static async consumeToken(token) {
    if (!token) {
      return { valid: false, reason: 'Token is required' };
    }

    const key = `token:${token}`;
    
    // Atomic: use Redis DELETE to check if token exists and consume it
    const result = await redis.del(key);
    
    if (result === 0) {
      return { valid: false, reason: 'Token not found or expired' };
    }
    
    return { valid: true };
  }

  // Check if token exists without consuming it
  static async checkToken(token) {
    if (!token) {
      return false;
    }

    const key = `token:${token}`;
    const exists = await redis.exists(key);
    
    return exists === 1;
  }

  // Clean up expired tokens (optional maintenance)
  static async cleanupExpiredTokens() {
    const pattern = 'token:*';
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      // Redis automatically handles expired keys, but this is for manual cleanup
      console.log(`Found ${keys.length} tokens in Redis`);
    }
    
    return keys.length;
  }
}

module.exports = TokenService;
