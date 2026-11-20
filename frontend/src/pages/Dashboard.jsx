import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load dashboard."));
  }, []);

  if (error) return <div className="container"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="container">Loading dashboard...</div>;

  return (
    <div className="container">
      <h2 style={{ marginBottom: "18px" }}>Dashboard — {data.organization_name}</h2>

      <div className="grid-2">
        <div className="card">
          <div className="stat-label">Total Products</div>
          <div className="stat-value">{data.total_products}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total Quantity on Hand</div>
          <div className="stat-value">{data.total_quantity}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3>Low Stock Items</h3>
          <Link to="/products" className="btn btn-primary btn-sm">Manage Products</Link>
        </div>

        {data.low_stock_items.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>No low-stock items right now.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Quantity on Hand</th>
                <th>Low Stock Threshold</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td><span className="badge-low">{item.quantity_on_hand}</span></td>
                  <td>{item.low_stock_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}