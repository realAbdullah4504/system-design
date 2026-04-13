import sessionService from '../services/session-service.js';

async function testSessionService() {
  console.log('Testing Session Service...\n');

  try {
    // Test 1: Create a session
    console.log('1. Creating session...');
    const userData = { id: 'user123', email: 'test@example.com', name: 'Test User' };
    const { sessionId, sessionData } = await sessionService.createSession(userData);
    console.log('Session created:', { sessionId, user: sessionData.user });

    // Test 2: Get session
    console.log('\n2. Getting session...');
    const session = await sessionService.getSession(sessionId);
    console.log('Session retrieved:', { id: session.id, user: session.user, lastAccessed: session.lastAccessed });

    // Test 3: Update session
    console.log('\n3. Updating session...');
    const updatedSession = await sessionService.updateSession(sessionId, { 
      user: { ...session.user, lastLogin: new Date().toISOString() }
    });
    console.log('Session updated:', { user: updatedSession.user });

    // Test 4: Refresh session
    console.log('\n4. Refreshing session...');
    const refreshed = await sessionService.refreshSession(sessionId);
    console.log('Session refreshed:', refreshed);

    // Test 5: Delete session
    console.log('\n5. Deleting session...');
    const deleted = await sessionService.deleteSession(sessionId);
    console.log('Session deleted:', deleted);

    // Test 6: Try to get deleted session
    console.log('\n6. Trying to get deleted session...');
    const deletedSession = await sessionService.getSession(sessionId);
    console.log('Deleted session retrieved:', deletedSession);

    console.log('\nAll tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testSessionService().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
