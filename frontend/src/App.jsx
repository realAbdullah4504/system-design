import React,{ useEffect, useState } from "react";

function App() {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Create session on page load
  const createSession = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: {
            id: "frontend-user-" + Math.random().toString(36).substr(2, 9),
            name: "Frontend User",
            email: "user@example.com"
          }
        }),
      });

      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
        console.log("Session created:", sessionData);
        return sessionData.sessionId;
      } else {
        console.error("Failed to create session");
        return null;
      }
    } catch (err) {
      console.error("Error creating session:", err);
      return null;
    }
  };

  // Fetch initial events
  const fetchEvents = () => {
    fetch("http://localhost:3000/api/events", {
      credentials: "include" // Include cookies for session
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.events) {
          setEvents(data.events);
        }
        if (data.user) {
          setSession({ user: data.user });
        }
      })
      .catch((err) => console.error(err));
  };

  // Initialize session and setup SSE connection
  useEffect(() => {
    // Create session first, then fetch events
    const initializeApp = async () => {
      setSessionLoading(true);
      await createSession();
      setSessionLoading(false);
      fetchEvents();
    };
    
    initializeApp();

    const eventSource = new EventSource("http://localhost:3000/api/events/stream");
    
    eventSource.onopen = () => {
      console.log("SSE connection opened");
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE message:", data);
        
        if (data.type === "connected") {
          console.log("Connected to event stream:", data.timestamp);
        } else if (data.type === "error") {
          console.error("SSE error:", data.message);
        } else {
          console.log("SSE message:", event.data);
          // New event received from database
          setEvents(prevEvents => {
            // Check if event already exists to avoid duplicates
            const exists = prevEvents.some(e => e._id === data._id);
            if (!exists) {
              return [data, ...prevEvents];
            }
            return prevEvents;
          });
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const sendEvent = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/events/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for session
        body: JSON.stringify({
          type: "test_event",
          payload: {
            message: "Hello from frontend",
            timestamp: new Date().toISOString(),
            user: session?.user || null,
          },
        }),
      });

      if (response.ok) {
        console.log("Event sent successfully");
      } else {
        console.error("Failed to send event");
      }
    } catch (err) {
      console.error("Error sending event:", err);
    }
  };
return (
    <div style={{ padding: "20px" }}>
      <h1>Events</h1>
      
      {/* Session Status */}
      <div style={{ 
        padding: "10px", 
        marginBottom: "20px", 
        backgroundColor: session ? "#d1ecf1" : "#f8d7da",
        borderRadius: "5px",
        border: `1px solid ${session ? "#bee5eb" : "#f5c6cb"}`
      }}>
        <span style={{ 
          color: session ? "#0c5460" : "#721c24",
          fontWeight: "bold"
        }}>
          {sessionLoading ? "🔄 Creating session..." : 
           session ? `👤 Logged in as: ${session.user?.name || session.user?.id || "Unknown User"}` : 
           "🔴 No session"}
        </span>
      </div>

      {/* Connection Status */}
      <div style={{ 
        padding: "10px", 
        marginBottom: "20px", 
        backgroundColor: isConnected ? "#d4edda" : "#f8d7da",
        borderRadius: "5px",
        border: `1px solid ${isConnected ? "#c3e6cb" : "#f5c6cb"}`
      }}>
        <span style={{ 
          color: isConnected ? "#155724" : "#721c24",
          fontWeight: "bold"
        }}>
          {isConnected ? "🟢 Connected to real-time updates" : "🔴 Disconnected from real-time updates"}
        </span>
      </div>

      <button 
        onClick={sendEvent}
        disabled={!session || sessionLoading}
        style={{
          padding: "10px 20px",
          backgroundColor: session && !sessionLoading ? "#007bff" : "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: session && !sessionLoading ? "pointer" : "not-allowed",
          marginBottom: "20px",
          opacity: session && !sessionLoading ? 1 : 0.6
        }}
      >
        {sessionLoading ? "Creating Session..." : session ? "Send Test Event" : "Please wait..."}
      </button>
      
      <div style={{ marginBottom: "10px" }}>
        <strong>Total Events: {events.length}</strong>
      </div>
      
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event._id} style={{ 
              marginBottom: "10px",
              padding: "10px",
              backgroundColor: "#f8f9fa",
              borderRadius: "5px",
              border: "1px solid #dee2e6"
            }}>
              <strong>{event.type}</strong>: {JSON.stringify(event.payload)} -{" "}
              {new Date(event.receivedAt || event.createdAt || event.timestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
