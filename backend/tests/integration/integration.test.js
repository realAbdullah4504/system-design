import mongoose from 'mongoose';
import { redis, subscriber, publisher } from '../../config/redis.js';
import { snsClient } from '../../config/sns.js';
import Event from '../../models/event.js';
import { publishJobEvent } from '../../services/sns.js';

const integrationTests = [
  {
    name: 'Database Connection',
    test: async () => {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ MongoDB connection successful');
        
        // Test basic CRUD operations
        const testEvent = new Event({
          type: 'test',
          payload: { message: 'Integration test event' },
          receivedAt: new Date()
        });
        
        await testEvent.save();
        const savedEvent = await Event.findById(testEvent._id);
        
        if (!savedEvent || savedEvent.type !== 'test') {
          throw new Error('Event CRUD operations failed');
        }
        
        await Event.deleteMany({ type: 'test' });
        console.log('✓ Database CRUD operations successful');
      } catch (error) {
        throw new Error(`Database test failed: ${error.message}`);
      }
    }
  },
  {
    name: 'Redis Connection',
    test: async () => {
      try {
        // Test main Redis connection
        await redis.ping();
        console.log('✓ Main Redis connection successful');
        
        // Test subscriber connection
        await subscriber.ping();
        console.log('✓ Redis subscriber connection successful');
        
        // Test publisher connection
        await publisher.ping();
        console.log('✓ Redis publisher connection successful');
        
        // Test basic Redis operations
        await redis.set('test-key', 'test-value');
        const value = await redis.get('test-key');
        
        if (value !== 'test-value') {
          throw new Error('Redis set/get operations failed');
        }
        
        await redis.del('test-key');
        console.log('✓ Redis operations successful');
      } catch (error) {
        throw new Error(`Redis test failed: ${error.message}`);
      }
    }
  },
  {
    name: 'SNS Service',
    test: async () => {
      try {
        if (!process.env.TOPIC_ARN) {
          console.log('⚠️  SNS not configured, skipping test');
          return;
        }
        
        // Test SNS client initialization
        if (!snsClient) {
          throw new Error('SNS client not initialized');
        }
        
        console.log('✓ SNS client initialized successfully');
        
        // Test publishing (this will fail if credentials are not properly set, but that's expected in test env)
        try {
          await publishJobEvent({
            type: 'test-integration',
            payload: { message: 'Integration test message' }
          });
          console.log('✓ SNS publish operation successful');
        } catch (snsError) {
          if (snsError.message.includes('credentials') || snsError.message.includes('unauthorized')) {
            console.log('⚠️  SNS credentials not configured, publish test skipped');
          } else {
            throw snsError;
          }
        }
      } catch (error) {
        throw new Error(`SNS test failed: ${error.message}`);
      }
    }
  },
  {
    name: 'Event Model Validation',
    test: async () => {
      try {
        // Test valid event
        const validEvent = new Event({
          type: 'test',
          payload: { message: 'Valid event' },
          receivedAt: new Date()
        });
        
        const validationError = validEvent.validateSync();
        if (validationError) {
          throw new Error(`Valid event validation failed: ${validationError.message}`);
        }
        
        // Test invalid event (missing required fields)
        const invalidEvent = new Event({
          type: 'test'
          // missing payload
        });
        
        const invalidValidationError = invalidEvent.validateSync();
        if (!invalidValidationError) {
          throw new Error('Invalid event should have failed validation');
        }
        
        console.log('✓ Event model validation working correctly');
      } catch (error) {
        throw new Error(`Event model test failed: ${error.message}`);
      }
    }
  },
  {
    name: 'Service Dependencies',
    test: async () => {
      try {
        // Test that all required services are available
        const services = {
          mongoose: mongoose.connection.readyState === 1,
          redis: !!redis,
          subscriber: !!subscriber,
          publisher: !!publisher,
          snsClient: !!snsClient
        };
        
        const unavailableServices = Object.entries(services)
          .filter(([_, available]) => !available)
          .map(([name]) => name);
        
        if (unavailableServices.length > 0) {
          console.log(`⚠️  Some services unavailable: ${unavailableServices.join(', ')}`);
        } else {
          console.log('✓ All service dependencies available');
        }
        
        // Test service health
        const healthChecks = await Promise.allSettled([
          redis.ping().catch(() => false),
          subscriber.ping().catch(() => false),
          publisher.ping().catch(() => false)
        ]);
        
        const healthyServices = healthChecks.filter(result => 
          result.status === 'fulfilled' && result.value === 'PONG'
        ).length;
        
        console.log(`✓ ${healthyServices}/3 Redis services healthy`);
      } catch (error) {
        throw new Error(`Service dependencies test failed: ${error.message}`);
      }
    }
  }
];

async function runIntegrationTests() {
  console.log('🧪 Starting integration tests...');
  
  const results = [];
  
  for (const test of integrationTests) {
    try {
      console.log(`\nRunning: ${test.name}`);
      await test.test();
      results.push({ name: test.name, status: 'passed' });
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      results.push({ name: test.name, status: 'failed', error: error.message });
    }
  }
  
  console.log('\n📊 Integration Test Results:');
  for (const result of results) {
    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const failedTests = results.filter(r => r.status === 'failed');
  if (failedTests.length > 0) {
    console.log(`\n❌ ${failedTests.length} integration test(s) failed`);
    process.exit(1);
  }
  
  console.log('\n✅ All integration tests passed!');
}

async function cleanup() {
  try {
    await mongoose.disconnect();
    await redis.quit();
    await subscriber.quit();
    await publisher.quit();
    console.log('\n🧹 Cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

try {
  await runIntegrationTests();
  await cleanup();
} catch (error) {
  console.error('❌ Integration test runner failed:', error);
  await cleanup();
  process.exit(1);
}
