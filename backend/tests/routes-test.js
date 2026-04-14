import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function testRoutes() {
  console.log('Testing Refactored Routes...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('Health check status:', healthResponse.data.status);
    console.log('Services:', Object.keys(healthResponse.data.services));

    // Test 2: Async wait
    console.log('\n2. Testing async wait...');
    const asyncStart = Date.now();
    const asyncResponse = await axios.get(`${BASE_URL}/async-wait`);
    const asyncDuration = Date.now() - asyncStart;
    console.log('Async wait response:', asyncResponse.data);
    console.log('Duration:', asyncDuration, 'ms');

    // Test 3: Get events (empty initially)
    console.log('\n3. Testing get events...');
    const eventsResponse = await axios.get(`${BASE_URL}/events`);
    console.log('Events count:', eventsResponse.data.length);

    // Test 4: Send event
    console.log('\n4. Testing send event...');
    const eventResponse = await axios.post(`${BASE_URL}/events/send`, {
      type: 'test',
      payload: { message: 'Test event', timestamp: new Date().toISOString() }
    });
    console.log('Event sent:', eventResponse.data.message);

    // Test 5: Create session
    console.log('\n5. Testing session creation...');
    const sessionResponse = await axios.post(`${BASE_URL}/sessions`, {
      user: { id: 'test123', email: 'test@example.com', name: 'Test User' }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Session created:', sessionResponse.data.sessionId);

    // Test 6: Get current session
    console.log('\n6. Testing get current session...');
    const currentSessionResponse = await axios.get(`${BASE_URL}/current`, {
      headers: { 
        'Cookie': sessionResponse.headers['set-cookie']?.[0] || '',
        'Content-Type': 'application/json'
      }
    });
    console.log('Current session user:', currentSessionResponse.data.user?.name);

    console.log('\nAll route tests completed successfully!');

  } catch (error) {
    if (error.response) {
      console.error('Test failed:', error.response.status, error.response.data);
    } else {
      console.error('Test failed:', error.message);
    }
  }
}

// Run the test
testRoutes().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Route test suite failed:', error.message);
  process.exit(1);
});
