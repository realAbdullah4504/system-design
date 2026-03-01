import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const integrationTests = {
  async runAllTests() {
    console.log('🧪 Starting Integration Tests...');
    
    const tests = [
      this.testHealthEndpoint,
      this.testEventsEndpoint,
      this.testSendEventEndpoint,
      this.testAsyncWaitEndpoint,
      this.testEventStreamEndpoint,
      this.testFullEventFlow
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test.call(this);
        passed++;
        console.log(`✅ ${test.name} - PASSED`);
      } catch (error) {
        failed++;
        console.error(`❌ ${test.name} - FAILED:`, error.message);
      }
    }

    console.log(`\n📊 Integration Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
      throw new Error(`${failed} integration tests failed`);
    }
  },

  async testHealthEndpoint() {
    console.log('Testing health endpoint...');
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 10000 });
    throw new Error('Health check failed');
    
    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    
    if (!response.data.status || !response.data.services) {
      throw new Error('Health check response missing required fields');
    }
    
    console.log('✓ Health endpoint working');
  },

  async testEventsEndpoint() {
    console.log('Testing events endpoint...');
    const response = await axios.get(`${API_BASE_URL}/events`, { timeout: 10000 });
    
    if (response.status !== 200) {
      throw new Error(`Events endpoint failed with status ${response.status}`);
    }
    
    if (!Array.isArray(response.data)) {
      throw new Error('Events endpoint should return an array');
    }
    
    console.log(`✓ Events endpoint returned ${response.data.length} events`);
  },

  async testSendEventEndpoint() {
    console.log('Testing send event endpoint...');
    const testEvent = {
      type: 'integration-test',
      payload: {
        message: 'Integration test event',
        timestamp: new Date().toISOString(),
        testId: 'integration-' + Date.now()
      }
    };

    const response = await axios.post(`${API_BASE_URL}/events/send`, testEvent, { 
      timeout: 15000 
    });
    
    if (response.status !== 200) {
      throw new Error(`Send event failed with status ${response.status}`);
    }
    
    if (!response.data.message || !response.data.type) {
      throw new Error('Send event response missing required fields');
    }
    
    console.log('✓ Send event endpoint working');
  },

  async testAsyncWaitEndpoint() {
    console.log('Testing async wait endpoint...');
    const startTime = Date.now();
    
    const response = await axios.get(`${API_BASE_URL}/async-wait`, { timeout: 5000 });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.status !== 200) {
      throw new Error(`Async wait failed with status ${response.status}`);
    }
    
    if (duration < 200) {
      throw new Error(`Async wait should take at least 200ms, took ${duration}ms`);
    }
    
    console.log(`✓ Async wait endpoint working (${duration}ms)`);
  },

  async testEventStreamEndpoint() {
    console.log('Testing event stream endpoint...');
    
    return new Promise((resolve, reject) => {
      const axiosConfig = {
        method: 'get',
        url: `${API_BASE_URL}/events/stream`,
        responseType: 'stream',
        timeout: 10000
      };

      const request = axios(axiosConfig);
      
      let receivedData = false;
      let connected = false;
      
      const timeout = setTimeout(() => {
        request.destroy();
        if (!connected) {
          reject(new Error('Event stream connection timeout'));
        } else {
          resolve();
        }
      }, 5000);

      request.then(response => {
        if (response.status !== 200) {
          clearTimeout(timeout);
          reject(new Error(`Event stream failed with status ${response.status}`));
          return;
        }

        response.data.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('data: ')) {
            receivedData = true;
            connected = true;
            clearTimeout(timeout);
            request.destroy();
            console.log('✓ Event stream endpoint working');
            resolve();
          }
        });

        response.data.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Event stream error: ${error.message}`));
        });

      }).catch(error => {
        clearTimeout(timeout);
        reject(new Error(`Event stream request failed: ${error.message}`));
      });
    });
  },

  async testFullEventFlow() {
    console.log('Testing full event flow...');
    
    // 1. Send an event
    const testEvent = {
      type: 'flow-test',
      payload: {
        message: 'Full flow test event',
        timestamp: new Date().toISOString(),
        testId: 'flow-' + Date.now()
      }
    };

    const sendResponse = await axios.post(`${API_BASE_URL}/events/send`, testEvent, { 
      timeout: 15000 
    });
    
    if (sendResponse.status !== 200) {
      throw new Error('Event sending failed in flow test');
    }

    // 2. Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Check if event appears in events list
    const eventsResponse = await axios.get(`${API_BASE_URL}/events`, { timeout: 10000 });
    
    if (eventsResponse.status !== 200) {
      throw new Error('Events retrieval failed in flow test');
    }

    const events = eventsResponse.data;
    const foundEvent = events.find(event => 
      event.type === 'flow-test' && 
      event.payload && 
      event.payload.testId === testEvent.payload.testId
    );

    if (!foundEvent) {
      console.log('Available events:', events.map(e => ({ type: e.type, testId: e.payload?.testId })));
      throw new Error('Sent event not found in events list');
    }

    console.log('✓ Full event flow working');
  }
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  integrationTests.runAllTests()
    .then(() => {
      console.log('🎉 All integration tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Integration tests failed:', error.message);
      process.exit(1);
    });
}

export default integrationTests;
