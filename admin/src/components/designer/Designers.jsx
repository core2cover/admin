"use client";

import { useEffect, useState } from "react";
import "./Designers.css";
import Sidebar from "../sidebar/Sidebar";
import { useNavigate } from "react-router-dom";

const Designers = () => {
  const [search, setSearch] = useState("");
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const handleDeleteDesigner = async (id) => {
    if (!window.confirm("Are you sure you want to delete this designer? This action cannot be undone.")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`http://localhost:5000/admin/designers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        // Remove the designer from the local state
        setDesigners((prev) => prev.filter((d) => d.id !== id));
      } else {
        alert(data.error || "Failed to delete designer");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting.");
    } finally {
      setActionLoading(null);
    }
  };

  const navigate = useNavigate();

  const fetchDesigners = async () => {
    try {
      const res = await fetch("http://localhost:5000/admin/designers");
      const data = await res.json();
      setDesigners(data);
    } catch (err) {
      console.error("Failed to load designers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
  }, []);

  // VERIFICATION HANDLER
  const handleToggleVerify = (id, currentIsVerified) => {
    setActionLoading(id);
    const newVerifiedState = !currentIsVerified;

    fetch(`http://localhost:5000/admin/designers/${id}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: newVerifiedState }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Update local state instantly
          setDesigners((prev) =>
            prev.map((d) =>
              d.id === id
                ? { ...d, isVerified: data.isVerified, status: data.isVerified ? "ACTIVE" : "PENDING" }
                : d
            )
          );
        }
      })
      .catch((err) => console.error("Update error:", err))
      .finally(() => setActionLoading(null));
  };

  const filteredDesigners = designers.filter((d) =>
    `${d.fullname || ""} ${d.email || ""} ${d.phone || ""} ${d.location || ""} ${d.availability || ""} ${d.status || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <Sidebar />

      <div className="designers-page">
        <div className="designers-header">
          <div>
            <h1>Designers</h1>
            <p>Interior designers registered on Core2Cover</p>
          </div>

          <input
            type="text"
            className="designer-search"
            placeholder="Search name, location, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="designers-stats">
          <div className="stat_card">
            <h3>Total Designers</h3>
            <span>{designers.length}</span>
          </div>
          <div className="stat_card">
            <h3>Verified (Active)</h3>
            <span>{designers.filter(d => d.isVerified).length}</span>
          </div>
          <div className="stat_card">
            <h3>Available</h3>
            <span>{designers.filter(d => d.availability === "AVAILABLE").length}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading designers...</div>
        ) : (
          <div className="designers-table-wrapper">
            <table className="designers-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Experience</th>
                  <th>Availability</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDesigners.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-strong">{d.fullname}</td>
                    <td>
                      <div className="contact-info">
                        <span>{d.email || "-"}</span>
                        <small>{d.phone || "-"}</small>
                      </div>
                    </td>
                    <td>{d.location}</td>
                    <td>{d.experience} Yrs</td>

                    <td>
                      <span className={`badge ${d.availability === "AVAILABLE" ? "success" : "pending"}`}>
                        {d.availability}
                      </span>
                    </td>

                    <td>
                      <span className={`status ${d.status.toLowerCase()}`}>
                        {d.status}
                      </span>
                    </td>

                    <td className="actions-cell">
                      <button
                        className="btn-view"
                        onClick={() => navigate("/designer-works", { state: { designerId: d.id } })}
                      >
                        Works
                      </button>

                      <button
                        className={`btn-verify-small ${d.isVerified ? 'unverify' : 'verify'}`}
                        onClick={() => handleToggleVerify(d.id, d.isVerified)}
                        disabled={actionLoading === d.id}
                      >
                        {actionLoading === d.id ? "..." : d.isVerified ? "Revoke" : "Verify"}
                      </button>

                      <button
                        className="btn-delete-small"
                        onClick={() => handleDeleteDesigner(d.id)}
                        disabled={actionLoading === d.id}
                      >
                        {actionLoading === d.id ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredDesigners.length === 0 && (
          <div className="empty-state">No designers found</div>
        )}
      </div>
    </>
  );
};

export default Designers;