import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const smokeTests = [
  {
    name: 'Health Check',
    test: async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      if (response.data.status !== 'ok') {
        throw new Error(`Service status is not ok: ${response.data.status}`);
      }
      console.log('✓ Health check passed');
    }
  },
  {
    name: 'Events Endpoint',
    test: async () => {
      const response = await axios.get(`${API_BASE_URL}/events`);
      if (response.status !== 200) {
        throw new Error(`Events endpoint failed with status ${response.status}`);
      }
      console.log('✓ Events endpoint passed');
    }
  },
  {
    name: 'Send Event Endpoint',
    test: async () => {
      const response = await axios.post(`${API_BASE_URL}/events/send`, {
        type: 'test',
        payload: {
          message: 'Test event from smoke test'
        }
      });
      if (response.status !== 200) {
        throw new Error(`Send event endpoint failed with status ${response.status}`);
      }
      console.log('✓ Send event endpoint passed');
    }
  },
  {
    name: 'Async Wait Endpoint',
    test: async () => {
      const response = await axios.get(`${API_BASE_URL}/async-wait`);
      if (response.status !== 200) {
        throw new Error(`Async wait endpoint failed with status ${response.status}`);
      }
      if (!response.data.ok) {
        throw new Error('Async wait response not ok');
      }
      console.log('✓ Async wait endpoint passed');
    }
  }
];

async function runSmokeTests() {
  console.log('🚀 Starting smoke tests...');
  
  const results = [];
  
  for (const test of smokeTests) {
    try {
      console.log(`\nRunning: ${test.name}`);
      await test.test();
      results.push({ name: test.name, status: 'passed' });
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      results.push({ name: test.name, status: 'failed', error: error.message });
    }
  }
  
  console.log('\n📊 Test Results:');
  for (const result of results) {
    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const failedTests = results.filter(r => r.status === 'failed');
  if (failedTests.length > 0) {
    console.log(`\n❌ ${failedTests.length} smoke test(s) failed`);
    process.exit(1);
  }
  
  console.log('\n✅ All smoke tests passed!');
}

try {
  await runSmokeTests();
} catch (error) {
  console.error('❌ Smoke test runner failed:', error);
  process.exit(1);
}
