import { useEffect, useState } from "react";
import api from "../api/client";

const emptyForm = {
  name: "",
  sku: "",
  description: "",
  quantity_on_hand: 0,
  cost_price: "",
  selling_price: "",
  low_stock_threshold: "",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const fetchProducts = async (query = search) => {
    try {
      const res = await api.get("/api/products", { params: query ? { search: query } : {} });
      setProducts(res.data);
    } catch {
      setError("Failed to load products.");
    }
  };

  useEffect(() => {
    fetchProducts("");
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      description: p.description ?? "",
      quantity_on_hand: p.quantity_on_hand,
      cost_price: p.cost_price ?? "",
      selling_price: p.selling_price ?? "",
      low_stock_threshold: p.low_stock_threshold ?? "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || null,
      quantity_on_hand: Number(form.quantity_on_hand),
      cost_price: form.cost_price === "" ? null : Number(form.cost_price),
      selling_price: form.selling_price === "" ? null : Number(form.selling_price),
      low_stock_threshold: form.low_stock_threshold === "" ? null : Number(form.low_stock_threshold),
    };

    try {
      if (editingId) {
        await api.put(`/api/products/${editingId}`, payload);
      } else {
        await api.post("/api/products", payload);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save product.");
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}" (SKU: ${p.sku})?`)) return;
    try {
      await api.delete(`/api/products/${p.id}`);
      fetchProducts();
    } catch {
      setError("Could not delete product.");
    }
  };

  const handleAdjust = async (p, delta) => {
    try {
      await api.patch(`/api/products/${p.id}/adjust`, { delta });
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.detail || "Stock adjustment failed.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
          <h2>Products</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Search by Name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                fetchProducts(e.target.value);
              }}
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
            />
            <button className="btn btn-primary" onClick={openCreate}>+ Add Product</button>
          </div>
        </div>

        {products.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "14px" }}>No products found. Click &quot;+ Add Product&quot; to create one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Selling Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdjust(p, -1)}>-</button>
                    <span style={{ margin: "0 10px", fontWeight: 600 }}>{p.quantity_on_hand}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAdjust(p, 1)}>+</button>
                  </td>
                  <td>
                    {p.is_low_stock ? (
                      <span className="badge-low">Low Stock</span>
                    ) : (
                      <span className="badge-ok">In Stock</span>
                    )}
                  </td>
                  <td>{p.selling_price != null ? `$${Number(p.selling_price).toFixed(2)}` : "—"}</td>
                  <td style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ marginBottom: "14px" }}>{editingId ? "Edit Product" : "Add Product"}</h3>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>SKU *</label>
                <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Quantity on Hand *</label>
                <input type="number" min="0" required value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Cost Price</label>
                <input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Selling Price</label>
                <input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Low Stock Threshold (leave blank for org default)</label>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? "Save Changes" : "Create Product"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}