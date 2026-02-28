import React,{ useEffect, useState } from "react";

function App() {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial events
  const fetchEvents = () => {
    fetch("http://api-service-loadbalancer-1775317050.us-east-1.elb.amazonaws.com/events")
      .then((res) => res.json())
      .then((data) => setEvents(data))
      .catch((err) => console.error(err));
  };

  // Setup SSE connection
  useEffect(() => {
    fetchEvents();

    const eventSource = new EventSource("http://api-service-loadbalancer-1775317050.us-east-1.elb.amazonaws.com/events/stream");
    
    eventSource.onopen = () => {
      console.log("SSE connection opened");
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
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
      const response = await fetch("http://api-service-loadbalancer-1775317050.us-east-1.elb.amazonaws.com/events/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test_event",
          payload: {
            message: "Hello from frontend",
            timestamp: new Date().toISOString(),
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
console.log(events)
  return (
    <div style={{ padding: "20px" }}>
      <h1>Events</h1>
      
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
        style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginBottom: "20px"
        }}
      >
        Send Test Event
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
