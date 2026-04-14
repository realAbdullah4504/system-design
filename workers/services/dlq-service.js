import RetryService from './retry-service.js';

class DLQService {
  constructor(options = {}) {
    this.retryService = new RetryService(options.retry);
    this.dlqThreshold = options.dlqThreshold || 5;
    this.dlqTTL = options.dlqTTL || 86400000; // 24 hours
    this.errorClassifiers = options.errorClassifiers || this.getDefaultClassifiers();
    this.metrics = {
      dlqCount: 0,
      retryCount: 0,
      classificationCounts: {}
    };
  }

  getDefaultClassifiers() {
    return {
      transient: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
      permanent: ['EACCES', 'EPERM', 'ENOENT', 'EEXIST'],
      business: ['VALIDATION_ERROR', 'BUSINESS_RULE_VIOLATION'],
      system: ['OUT_OF_MEMORY', 'DISK_FULL', 'SYSTEM_OVERLOAD']
    };
  }

  async processMessage(message, processor, options = {}) {
    const messageId = message.id || this.generateMessageId();
    
    try {
      return await this.retryService.execute(
        () => processor(message),
        {
          operationName: `process-message-${messageId}`,
          ...options.retry
        }
      );
    } catch (error) {
      const classification = this.classifyError(error);
      
      if (classification === 'transient' && message.retryCount < this.dlqThreshold) {
        message.retryCount = (message.retryCount || 0) + 1;
        this.metrics.retryCount++;
        throw error; // Re-throw for retry
      }
      
      // Send to DLQ
      await this.sendToDLQ(message, error, classification);
      this.metrics.dlqCount++;
      this.metrics.classificationCounts[classification] = 
        (this.metrics.classificationCounts[classification] || 0) + 1;
      
      return { dlqSent: true, classification, error: error.message };
    }
  }

  classifyError(error) {
    for (const [category, patterns] of Object.entries(this.errorClassifiers)) {
      if (error.code && patterns.includes(error.code)) {
        return category;
      }
      if (error.message && patterns.some(pattern => error.message.includes(pattern))) {
        return category;
      }
    }
    return 'unknown';
  }

  async sendToDLQ(message, error, classification) {
    const dlqEntry = {
      originalMessage: message,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      classification,
      timestamp: new Date().toISOString(),
      retryCount: message.retryCount || 0,
      expiresAt: new Date(Date.now() + this.dlqTTL).toISOString()
    };

    // In a real implementation, this would send to a DLQ queue/topic
    console.log('DLQ_ENTRY:', JSON.stringify(dlqEntry, null, 2));
    
    return dlqEntry;
  }

  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async retryDLQMessage(dlqEntry, processor, options = {}) {
    try {
      const result = await this.processMessage(
        dlqEntry.originalMessage,
        processor,
        options
      );
      
      if (result.dlqSent) {
        return { success: false, reason: 'Still failed processing' };
      }
      
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cleanupExpiredDLQEntries(dlqEntries) {
    const now = Date.now();
    return dlqEntries.filter(entry => {
      const expiresAt = new Date(entry.expiresAt).getTime();
      return expiresAt > now;
    });
  }
}

export default DLQService;
