class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.name = options.name || 'unknown';
    
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.successCount = 0;
  }

  async execute(operation, operationName = 'unknown') {
    // Import monitoring functions dynamically to avoid circular dependency
    const { setCircuitBreakerState, recordCircuitBreakerOperation, recordCircuitBreakerFailure } = await import('./prom.js');
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        setCircuitBreakerState('main-worker', this.name, this.state);
      } else {
        recordCircuitBreakerOperation('main-worker', this.name, 'rejected_open');
        throw new Error(`Circuit breaker is OPEN for ${operationName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      recordCircuitBreakerOperation('main-worker', this.name, 'success');
      return result;
    } catch (error) {
      this.onFailure(operationName);
      recordCircuitBreakerOperation('main-worker', this.name, 'failure');
      recordCircuitBreakerFailure('main-worker', this.name);
      throw error;
    }
  }

  async onSuccess(operationName) {
  if (this.state === 'HALF_OPEN') {
    this.successCount++;
    if (this.successCount >= 2) { // Need 2 successes to close
      this.reset();
    }
  } else {
    this.failureCount = Math.max(0, this.failureCount - 1);
  }
}

async onFailure(operationName) {
  this.failureCount++;
  this.lastFailureTime = Date.now();

  if (this.failureCount >= this.failureThreshold) {
    this.state = 'OPEN';
    // Import monitoring functions dynamically
    const { setCircuitBreakerState } = await import('./prom.js');
    setCircuitBreakerState('main-worker', this.name, this.state);
  }
}

async reset() {
  this.failureCount = 0;
  this.lastFailureTime = null;
  this.state = 'CLOSED';
  this.successCount = 0;
  // Import monitoring functions dynamically
  const { setCircuitBreakerState } = await import('./prom.js');
  setCircuitBreakerState('main-worker', this.name, this.state);
}

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export default CircuitBreaker;
