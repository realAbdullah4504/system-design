
import './App.css'
import { useState } from 'react'

function App() {
  const [token, setToken] = useState("");
  const [jobName, setJobName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [jobId, setJobId] = useState("");

  const API_BASE = "http://localhost:3000";

  const generateToken = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const response = await fetch(`${API_BASE}/tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 60 }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setMessage(`Token generated! Expires in ${data.expiresIn} seconds`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createJob = async () => {
    if (!jobName.trim()) {
      setMessage("Please enter a job name");
      return;
    }
    
    if (!token) {
      setMessage("Please generate a token first");
      return;
    }

    setLoading(true);
    setMessage("");
    
    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name: jobName,
          token: token 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setJobId(data.jobId);
        setMessage(`Job created successfully! Job ID: ${data.jobId}`);
        setToken(""); // Clear token after use
      } else {
        setMessage(`Error: ${data.error}${data.reason ? ` - ${data.reason}` : ""}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Job Processing System</h1>
      
      <div className="section">
        <h2>1. Generate Token</h2>
        <button 
          onClick={generateToken} 
          disabled={loading}
          className="token-btn"
        >
          {loading ? "Generating..." : "Generate Token"}
        </button>
        
        {token && (
          <div className="token-display">
            <p><strong>Token:</strong> {token}</p>
            <small>This token will be consumed when creating a job</small>
          </div>
        )}
      </div>

      <div className="section">
        <h2>2. Create Job</h2>
        <div className="job-form">
          <input
            type="text"
            placeholder="Enter job name"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            className="job-input"
          />
          <button 
            onClick={createJob} 
            disabled={loading || !token}
            className="job-btn"
          >
            {loading ? "Creating..." : "Create Job"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes("Error") ? "error" : "success"}`}>
          {message}
        </div>
      )}

      {jobId && (
        <div className="section">
          <h2>Job Status</h2>
          <p><strong>Job ID:</strong> {jobId}</p>
          <p>Check the backend console for job processing status</p>
        </div>
      )}
    </div>
  )
}

export default App
