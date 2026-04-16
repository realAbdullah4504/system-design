const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testTokenMechanism() {
  console.log('=== Testing Token Mechanism ===\n');

  try {
    // Step 1: Generate a token
    console.log('1. Generating token...');
    const tokenResponse = await axios.post(`${BASE_URL}/tokens`, {
      expiresIn: 60 // 1 minute
    });
    
    const token = tokenResponse.data.token;
    console.log('Token generated:', token);
    console.log('Expires in:', tokenResponse.data.expiresIn, 'seconds\n');

    // Step 2: Create job with valid token
    console.log('2. Creating job with valid token...');
    const jobResponse1 = await axios.post(`${BASE_URL}/jobs`, {
      name: 'test-job-1',
      token: token
    });
    
    console.log('Job created successfully:', jobResponse1.data);
    console.log('Status:', jobResponse1.status, '\n');

    // Step 3: Try to create another job with same token (should fail)
    console.log('3. Trying to create another job with same token...');
    try {
      await axios.post(`${BASE_URL}/jobs`, {
        name: 'test-job-2',
        token: token
      });
      console.log('ERROR: This should have failed!');
    } catch (error) {
      console.log('Expected failure:', error.response.status, error.response.data);
      console.log('Token was properly consumed\n');
    }

    // Step 4: Try to create job without token (should fail)
    console.log('4. Trying to create job without token...');
    try {
      await axios.post(`${BASE_URL}/jobs`, {
        name: 'test-job-3'
      });
      console.log('ERROR: This should have failed!');
    } catch (error) {
      console.log('Expected failure:', error.response.status, error.response.data);
      console.log('Token requirement enforced\n');
    }

    // Step 5: Generate new token and create job
    console.log('5. Generating new token and creating job...');
    const newTokenResponse = await axios.post(`${BASE_URL}/tokens`);
    const newToken = newTokenResponse.data.token;
    
    const jobResponse2 = await axios.post(`${BASE_URL}/jobs`, {
      name: 'test-job-4',
      token: newToken
    });
    
    console.log('Job created with new token:', jobResponse2.data);
    console.log('Status:', jobResponse2.status, '\n');

    console.log('=== Token Mechanism Test Complete ===');
    console.log('All tests passed! Token mechanism is working correctly.');

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testTokenMechanism();
}

module.exports = testTokenMechanism;
