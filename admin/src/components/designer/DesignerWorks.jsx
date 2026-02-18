import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../sidebar/Sidebar";
import "./DesignerWorks.css";
import { useNavigate } from "react-router-dom";

const DesignerWorks = () => {
  const { state } = useLocation();
  const designerId = state?.designerId;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!designerId) return;

    fetch(`http://localhost:5000/admin/designers/${designerId}/work-history`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch work history");
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [designerId]);

  const handleToggleVerify = (currentIsVerified) => {
    setActionLoading(true);
    const newVerifiedState = !currentIsVerified;

    fetch(`http://localhost:5000/admin/designers/${designerId}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: newVerifiedState }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Update the local designer object in the 'data' state
          setData((prev) => ({
            ...prev,
            designer: { ...prev.designer, isVerified: data.isVerified }
          }));
        }
      })
      .catch((err) => console.error("Update error:", err))
      .finally(() => setActionLoading(false));
  };

  // DELETE HANDLER
  const handleDeleteDesigner = async () => {
    if (!window.confirm("Are you sure you want to delete this designer? This will remove all their portfolio items and projects.")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/admin/designers/${designerId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        alert("Designer deleted successfully.");
        navigate("/designers"); // Redirect back to list
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      alert("Error during deletion.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!designerId) {
    return (
      <>
        <Sidebar />
        <div className="designer-works-page">
          <p>No designer selected.</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="designer-works-page">Loading work history…</div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Sidebar />
        <div className="designer-works-page">
          <p style={{ color: "red" }}>{error || "No data found"}</p>
        </div>
      </>
    );
  }


  const { designer, portfolioWorks, projectHistory } = data;
  return (
    <>
      <Sidebar />

      <div className="designer-works-page">
        {/* ======================
            DESIGNER HEADER
        ====================== */}
        <div className="designer-header">
          <div className="header-flex">
            {/* Profile Image Section */}
            <div className="profile-image-container">
              {designer.profileImage ? (
                <a href={designer.profileImage} target="_blank" rel="noreferrer">
                  <img
                    src={designer.profileImage}
                    alt={designer.fullname}
                    className="designer-avatar-large"
                    title="Click to view full size"
                  />
                </a>
              ) : (
                <div className="avatar-placeholder">{designer.fullname?.charAt(0)}</div>
              )}
            </div>

            <div className="header-text">
              <h1>{designer.fullname}</h1>
              <p className="designer-email">{designer.email}</p>
              <div className="admin-actions">
                <button
                  className={`btn-verify-small ${designer.isVerified ? 'unverify' : 'verify'}`}
                  onClick={() => handleToggleVerify(designer.isVerified)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : designer.isVerified ? "Revoke Verification" : "Verify Profile"}
                </button>

                <button
                  className="btn-delete-small"
                  onClick={handleDeleteDesigner}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : "Delete Designer Account"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================
            DESIGNER PROFILE
        ====================== */}
        <div className="designer-profile">
          <p><strong>Location:</strong> {designer.location || "-"}</p>
          <p><strong>Experience:</strong> {designer.experience}</p>
          <p><strong>Availability:</strong> {designer.availability}</p>
        </div>

        {/* ======================
            PORTFOLIO WORKS
        ====================== */}
        <section className="section">
          <h2>Portfolio Works</h2>

          {portfolioWorks.length === 0 ? (
            <p>No portfolio works uploaded.</p>
          ) : (
            <div className="works-grid">
              {portfolioWorks.map((work) => (
                <div key={work.id} className="work-card">
                  {/* Wrap the image in an anchor tag */}
                  <a href={work.image} target="_blank" rel="noreferrer" className="work-image-link">
                    <img src={work.image} alt="Designer work" title="Click to view full size" />
                  </a>

                  <p className="work-desc">
                    {work.description || "No description"}
                  </p>
                  <span className="work-date">
                    {new Date(work.createdAt).toDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================
            PROJECT HISTORY
        ====================== */}
        <section className="section">
          <h2>Project History</h2>

          {projectHistory.length === 0 ? (
            <p>No projects yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Work Type</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {projectHistory.map((p) => (
                  <tr key={p.id}>
                    <td>{p.clientName}</td>
                    <td>{p.workType}</td>
                    <td>₹{p.budget}</td>
                    <td>
                      <span className={`badge ${p.status}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {p.rating ? `⭐ ${p.rating}` : "—"}
                    </td>
                    <td>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
};

export default DesignerWorks;
