import { useEffect, useState } from "react";
import api from "../api/client";

export default function Settings() {
  const [threshold, setThreshold] = useState(5);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/settings")
      .then((res) => setThreshold(res.data.default_low_stock_threshold))
      .catch(() => setError("Failed to load settings."));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    setError("");
    try {
      await api.put("/api/settings", { default_low_stock_threshold: Number(threshold) });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update settings.");
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: "480px" }}>
        <h2 style={{ marginBottom: "14px" }}>Organization Settings</h2>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Settings saved!</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Default Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">Save Settings</button>
        </form>
      </div>
    </div>
  );
}