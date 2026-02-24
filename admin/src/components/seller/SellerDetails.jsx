"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // --- SEARCH & FILTER STATES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchDetails = () => {
    if (!sellerId) return;
    setLoading(true);

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

  // --- FILTER LOGIC ---
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category).filter(Boolean))];
  }, [products]);

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
          fetchDetails();
        }
      })
      .catch((err) => alert("Update failed"))
      .finally(() => setUpdating(false));
  };

  const handleVerify = () => {
    if (!seller) return;
    setUpdating(true);
    const newStatus = !seller.isVerified;

    fetch(`http://localhost:5000/admin/sellers/${sellerId}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Verification failed");
        return res.json();
      })
      .then((data) => {
        if (data.success) fetchDetails();
      })
      .catch((err) => alert("Action failed."))
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
            <h1>{business?.businessName || "Business Details"}</h1>
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
          {/* Seller Info */}
          <section className="section">
            <h2>Seller Info</h2>
            <p><strong>Name:</strong> {sellerInfo?.name}</p>
            <p><strong>Email:</strong> {sellerInfo?.email}</p>
            <p><strong>Phone:</strong> {sellerInfo?.phone}</p>
            <p><strong>Joined:</strong> {new Date(sellerInfo?.createdAt).toDateString()}</p>
          </section>

          {/* Business Details */}
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

          {/* Bank Details */}
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

          {/* RESTORED: Delivery Details Section */}
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
          <div className="products-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
            <h2>Products Listed ({filteredProducts.length})</h2>
            
            <div className="admin-filters-bar" style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Search product name..." 
                className="admin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
              <select 
                className="admin-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
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
                            <option value="Bathroom Fittings">Bathroom Fittings</option>
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
              {filteredProducts.length === 0 && <div className="no-results-msg" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No products match your filters.</div>}
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