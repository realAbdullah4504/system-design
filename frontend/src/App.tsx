import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:3000/jobs";

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [jobName, setJobName] = useState("");
  const [runningJobs, setRunningJobs] = useState({}); // track local running attempts

  // Fetch all jobs
  const fetchJobs = async () => {
    try {
      const { data } = await axios.get(API_URL);
      setJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000); // auto-refresh
    return () => clearInterval(interval);
  }, []);

  const createJob = async () => {
    if (!jobName) return;
    try {
      await axios.post(API_URL, { name: jobName });
      setJobName("");
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  // Run a job once
  const runJob = async (id) => {
    if (runningJobs[id]) {
      console.warn(`Duplicate attempt to run job ${id}`);
      return; // block additional clicks locally
    }
    setRunningJobs((prev) => ({ ...prev, [id]: true }));

    try {
      await axios.post(`${API_URL}/${id}/run`);
      fetchJobs();
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
    } finally {
      setRunningJobs((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Run a job multiple times to simulate race conditions
  const runJobRepeatedly = (id, count = 5, delay = 100) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => runJob(id), i * delay);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stage 1 Job Dashboard</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Job Name"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          className="border px-2 py-1 mr-2"
        />
        <button onClick={createJob} className="bg-blue-500 text-white px-3 py-1">
          Create Job
        </button>
      </div>

      <table className="border-collapse border border-gray-300 w-full">
        <thead>
          <tr>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="border px-2 py-1">{job.id}</td>
              <td className="border px-2 py-1">{job.name}</td>
              <td className="border px-2 py-1">{job.status}</td>
              <td className="border px-2 py-1 space-x-2">
                <button
                  onClick={() => runJob(job.id)}
                  disabled={job.status !== "CREATED" || runningJobs[job.id]}
                  className={`px-2 py-1 ${
                    job.status === "CREATED" && !runningJobs[job.id]
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 text-gray-700 cursor-not-allowed"
                  }`}
                >
                  Run Job
                </button>
                <button
                  onClick={() => runJobRepeatedly(job.id, 5, 100)}
                  disabled={job.status !== "CREATED"}
                  className="px-2 py-1 bg-red-500 text-white"
                >
                  Simulate Race
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
