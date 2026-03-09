"use client";

import { useEffect, useState } from "react";
import React from "react";
import "./Orders.css";
import Sidebar from "../sidebar/Sidebar";

const Orders = () => {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * DYNAMIC SERVICE FEE CALCULATION
   * Logic based on specific order value tiers provided:
   * < 500: 19 | 500-2000: 49 | 2000-10000: 89 | 10000-50000: 149 | > 50000: 299
   */
  const getPlatformCharge = (subtotal) => {
    const val = Number(subtotal) || 0;
    if (val === 0) return 0;
    if (val < 500) return 19;
    if (val >= 500 && val < 2000) return 49;
    if (val >= 2000 && val < 10000) return 89;
    if (val >= 10000 && val <= 50000) return 149;
    return 299;
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this order permanently?")) return;

    try {
      const res = await fetch(`http://localhost:5000/admin/orders/${orderId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setOrders(orders.filter((o) => o.id !== orderId));
        alert("Order deleted successfully");
      } else {
        throw new Error("Failed to delete order");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting order");
    }
  };

  useEffect(() => {
    fetch("http://localhost:5000/admin/orders")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch orders");
        return res.json();
      })
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredOrders = orders.filter((o) =>
    `${o.id} ${o.customerName} ${o.user?.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="orders-page">
          <p>Loading orders...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar />

      <div className="orders-page">
        <div className="orders-header">
          <div>
            <h1>Orders Management</h1>
            <p>Full price distribution and tiered service fee breakdown</p>
          </div>

          <input
            type="text"
            className="order-search"
            placeholder="Search by Order ID, Customer, or Phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Subtotal</th>
                <th className="fee-header">Service Fee</th>
                <th>Grand Total</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => {
                const serviceFee = getPlatformCharge(order.subtotal);
                // Separating the fee from the deliveryCharge stored in DB
                const pureDelivery = (order.deliveryCharge || 0) - serviceFee;

                return (
                  <React.Fragment key={order.id}>
                    {/* Main Summary Row */}
                    <tr className="main-order-row">
                      <td><strong>#ORD-{order.id}</strong></td>
                      <td>
                        <div className="cust-meta">
                          <span>{order.customerName}</span>
                          <small>{order.user?.phone || order.email}</small>
                        </div>
                      </td>
                      <td>₹{order.subtotal?.toLocaleString()}</td>
                      <td className="fee-highlight">₹{serviceFee}</td>
                      <td className="total-highlight">₹{order.grandTotal?.toLocaleString()}</td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="delete-order-btn" onClick={() => deleteOrder(order.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Detailed Distribution Row */}
                    <tr className="order-expansion-row">
                      <td colSpan="7">
                        <div className="price-distribution-container">
                          
                          {/* Financial Summary Grid */}
                          <div className="price-cards-grid">
                            <div className="price-dist-card">
                              <label>Items Subtotal</label>
                              <span>₹{order.subtotal?.toLocaleString()}</span>
                            </div>
                            <div className="price-dist-card">
                              <label>Pure Delivery</label>
                              <span>₹{Math.max(0, pureDelivery).toLocaleString()}</span>
                            </div>
                            <div className="price-dist-card service-fee-box">
                              <label>Service Fee</label>
                              <span>₹{serviceFee}</span>
                            </div>
                            <div className="price-dist-card">
                              <label>Installation</label>
                              <span>₹{order.installationTotal?.toLocaleString()}</span>
                            </div>
                            <div className="price-dist-card grand-box">
                              <label>Grand Total</label>
                              <span>₹{order.grandTotal?.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Items Breakdown Table */}
                          <div className="items-breakdown-wrapper">
                            <h3>Items Breakdown</h3>
                            <table className="inner-items-table">
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Seller</th>
                                  <th>Qty</th>
                                  <th>Base Price</th>
                                  <th>Shipping</th>
                                  <th>Install</th>
                                  <th>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item) => (
                                  <tr key={item.id}>
                                    <td>
                                      <div className="item-cell">
                                        <img src={item.imageUrl || "/placeholder.jpg"} alt="p" />
                                        <span>{item.materialName}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="seller-cell">
                                        {item.seller?.name || "N/A"}
                                        <small>{item.seller?.phone}</small>
                                      </div>
                                    </td>
                                    <td>{item.quantity} {item.unit}</td>
                                    <td>₹{item.pricePerUnit}</td>
                                    <td>₹{item.shippingCharge}</td>
                                    <td>₹{item.installationCharge || 0}</td>
                                    <td><strong>₹{item.totalAmount?.toLocaleString()}</strong></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="shipping-address-bar">
                             <strong>Delivery Address:</strong> {order.address}
                             {order.paymentMethod && <span className="pay-method">Method: {order.paymentMethod.toUpperCase()}</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="no-orders">No matching orders found.</div>
        )}
      </div>
    </>
  );
};

export default Orders;