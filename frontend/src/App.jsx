
import './App.css'
import { useState } from 'react'

function App() {
  const [jobName, setJobName] = useState("");
  const [message, setMessage] = useState("");
  const [jobId, setJobId] = useState("");

  const API_BASE = "http://localhost:3000";

  const ensureToken = async () => {
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
        return data.token;
      } else {
        throw new Error(data.error || 'Failed to generate token');
      }
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  };

  const createJob = async () => {
    try {
      // Automatically generate token when creating job
      const token = await ensureToken();
      
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
        setJobName(""); // Clear form
        setMessage(`Job created successfully! Job ID: ${data.jobId}`);
      } else {
        setMessage(`Error: ${data.error}${data.reason ? ` - ${data.reason}` : ""}`);
      }
    } catch (error) {
      setMessage(error.message);
    }
  };


  return (
    <div className="container">
      <h1>Job Processing System</h1>
      
      <div className="job-form-section">
        <h2>Create New Job</h2>
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
            className="job-btn"
          >
            Create Job
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes("Error") || message.includes("failed") ? "error" : "success"}`}>
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
