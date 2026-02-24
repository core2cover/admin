import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./SellerDetails.css";
import Sidebar from "../sidebar/Sidebar";

const SellerDetails = () => {
  const { state } = useLocation();
  const sellerId = state?.sellerId;

  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [selectedGallery, setSelectedGallery] = useState(null); // Stores [img1, img2...]
  const [showModal, setShowModal] = useState(false);

  // Helper to fetch/refresh details
  const fetchDetails = () => {
    if (!sellerId) return;
    setLoading(true);

    // Fetch both Seller Info and Seller Products
    Promise.all([
      fetch(`http://localhost:5000/admin/sellers/${sellerId}`).then(res => res.json()),
      fetch(`http://localhost:5000/admin/sellers/${sellerId}/products`).then(res => res.json())
    ])
      .then(([sellerData, productData]) => {
        setSeller(sellerData);
        setProducts(Array.isArray(productData) ? productData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDetails();
  }, [sellerId]);

  const handleProductUpdate = (id) => {
    setUpdating(true);
    fetch(`http://localhost:5000/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEditingId(null);
          fetchDetails(); // Refresh list
        }
      })
      .catch((err) => alert("Update failed"))
      .finally(() => setUpdating(false));
  };

  // Handler to toggle verification status
  const handleVerify = () => {
    if (!seller) return;
    setUpdating(true);

    // Toggle logic: if true, set to false; if false, set to true
    const newStatus = !seller.isVerified;

    fetch(`http://localhost:5000/admin/sellers/${sellerId}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          // Re-fetch to update the UI with new status and label
          fetchDetails();
        }
      })
      .catch((err) => {
        console.error("Verification error:", err);
        alert("Action failed. Please check the backend connection.");
      })
      .finally(() => setUpdating(false));
  };

  if (!sellerId) return <><Sidebar /><div className="seller-details-page"><p>No seller selected.</p></div></>;
  if (loading) return <><Sidebar /><div className="seller-details-page"><p>Loading seller details...</p></div></>;
  if (!seller) return <><Sidebar /><div className="seller-details-page"><p>Seller not found.</p></div></>;

  const { seller: sellerInfo, business, delivery, bank } = seller;

  return (
    <>
      <Sidebar />
      <div className="seller-details-page">
        <div className="seller-header">
          <div className="header-info">
            <h1>{business?.businessName || "Business details not provided"}</h1>
            <span className={`status ${seller.status.toLowerCase()}`}>
              {seller.status}
            </span>
          </div>

          <button
            className={`btn-verify ${seller.isVerified ? 'unverify' : 'verify'}`}
            onClick={handleVerify}
            disabled={updating}
          >
            {updating ? "Processing..." : seller.isVerified ? "Revoke Verification" : "Set Verified"}
          </button>
        </div>

        <div className="details-grid">
          {/* Seller Info Section */}
          <section className="section">
            <h2>Seller Info</h2>
            <p><strong>Name:</strong> {sellerInfo?.name}</p>
            <p><strong>Email:</strong> {sellerInfo?.email}</p>
            <p><strong>Phone:</strong> {sellerInfo?.phone}</p>
            <p><strong>Joined:</strong> {new Date(sellerInfo?.createdAt).toDateString()}</p>
          </section>

          {/* Business Details Section */}
          <section className="section">
            <h2>Business Details</h2>
            {business ? (
              <>
                <p><strong>Type:</strong> {business.sellerType || "-"}</p>
                <p><strong>City:</strong> {business.city || "-"}</p>
                <p><strong>Address:</strong> {business.address || "-"}</p>
                <p><strong>GST:</strong> {business.gst || "-"}</p>
              </>
            ) : <p className="muted">Business details not provided</p>}
          </section>

          {/* Bank Details Section */}
          <section className="section bank-details-section">
            <h2>Bank Details</h2>
            {bank ? (
              <>
                <p><strong>Account Holder:</strong> {bank.accountHolder}</p>
                <p><strong>Bank Name:</strong> {bank.bankName || "-"}</p>
                <p><strong>Account Number:</strong> {bank.accountNumber || "-"}</p>
                <p><strong>IFSC Code:</strong> {bank.ifsc || "-"}</p>
                <p><strong>UPI ID:</strong> {bank.upiId || "-"}</p>
              </>
            ) : <p className="muted">Bank details not provided</p>}
          </section>

          {/* Delivery Details Section */}
          <section className="section">
            <h2>Delivery</h2>
            {delivery ? (
              <>
                <p><strong>Time:</strong> {delivery.deliveryTimeMin || "-"}–{delivery.deliveryTimeMax || "-"} days</p>
                <p><strong>Charge:</strong> ₹{delivery.shippingCharge || 0}</p>
                <p><strong>Installation:</strong> {delivery.installationAvailable || "No"}</p>
              </>
            ) : <p className="muted">Delivery details not provided</p>}
          </section>
        </div>

        <div className="seller-products-section" style={{ marginTop: '40px' }}>
          <h2>Products Listed ({products.length})</h2>
          {products.length > 0 ? (
            <div className="admin-product-list">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="admin-image-stack" onClick={() => {
                          setSelectedGallery(p.images);
                          setShowModal(true);
                        }}>
                          <img
                            src={p.images?.[0] || "/placeholder.jpg"}
                            alt="p"
                            style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: 'pointer', borderRadius: '4px' }}
                          />
                          {p.images?.length > 1 && (
                            <span className="image-count">+{p.images.length - 1}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {editingId === p.id ? (
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        ) : p.name}
                      </td>
                      <td>
                        {editingId === p.id ? (
                          <select
                            value={editData.category}
                            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                          >
                            <option value="Furniture">Furniture</option>
                            <option value="Plywood & Boards">Plywood & Boards</option>
                            {/* Add other categories as needed */}
                          </select>
                        ) : p.category}
                      </td>
                      <td>
                        {editingId === p.id ? (
                          <textarea
                            className="admin-edit-textarea"
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          />
                        ) : (
                          <div className="admin-description-cell" title={p.description}>
                            {p.description ? (p.description.substring(0, 30) + (p.description.length > 30 ? "..." : "")) : "-"}
                          </div>
                        )}
                      </td>
                      <td>
                        {editingId === p.id ? (
                          <input
                            type="number"
                            value={editData.price}
                            onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                          />
                        ) : `₹${p.price}`}
                      </td>
                      <td>
                        {editingId === p.id ? (
                          <button className="btn-save" onClick={() => handleProductUpdate(p.id)}>Save</button>
                        ) : (
                          <button className="btn-edit" onClick={() => {
                            setEditingId(p.id);
                            setEditData({ name: p.name, category: p.category, description: p.description || "", price: p.price, productType: p.productType });
                          }}>Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">This seller hasn't listed any products yet.</p>
          )}
        </div>

        {showModal && (
          <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
              <h2>Product Gallery</h2>
              <div className="admin-gallery-grid">
                {selectedGallery?.map((img, idx) => (
                  <div key={idx} className="gallery-item">
                    <a href={img} target="_blank" rel="noreferrer">
                      <img src={img} alt={`product-${idx}`} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SellerDetails;