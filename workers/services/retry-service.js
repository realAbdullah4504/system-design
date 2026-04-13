class RetryService {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter !== false;
    this.retryableErrors = options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  }

  async execute(operation, operationOptions = {}) {
    const options = {
      maxRetries: operationOptions.maxRetries || this.maxRetries,
      baseDelay: operationOptions.baseDelay || this.baseDelay,
      maxDelay: operationOptions.maxDelay || this.maxDelay,
      backoffMultiplier: operationOptions.backoffMultiplier || this.backoffMultiplier,
      jitter: operationOptions.jitter !== undefined ? operationOptions.jitter : this.jitter,
      retryableErrors: operationOptions.retryableErrors || this.retryableErrors,
      ...operationOptions
    };

    let lastError;
    let attempt = 0;

    while (attempt <= options.maxRetries) {
      const operationName = options.operationName || 'unknown';
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt > options.maxRetries || !this.isRetryableError(error, options.retryableErrors)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, options);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  isRetryableError(error, retryableErrors) {
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }
    if (error.message && retryableErrors.some(pattern => error.message.includes(pattern))) {
      return true;
    }
    return false;
  }

  calculateDelay(attempt, options) {
    let delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, options.maxDelay);

    if (options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createOperationWrapper(operation, operationOptions = {}) {
    return async (...args) => {
      return this.execute(() => operation(...args), operationOptions);
    };
  }
}

export default RetryService;
