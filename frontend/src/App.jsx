import { useEffect, useState } from "react";

function App() {
  const [events, setEvents] = useState([]);

  const fetchEvents = () => {
    fetch("http://localhost:3000/events")
      .then((res) => res.json())
      .then((data) => setEvents(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const sendEvent = async () => {
    try {
      const response = await fetch("http://localhost:3000/events/send", {
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
        // Refresh events after sending
        // fetchEvents();
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
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event._id}>
              <strong>{event.type}</strong>: {JSON.stringify(event.payload)} -{" "}
              {new Date(event.receivedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
