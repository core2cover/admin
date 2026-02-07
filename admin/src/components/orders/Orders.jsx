import { useEffect, useState } from "react";
import React from "react";
import "./Orders.css";
import Sidebar from "../sidebar/Sidebar";

const Orders = () => {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
    `${o.id} ${o.user?.name || ""} ${o.user?.phone || ""}`
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
            <h1>Orders</h1>
            <p>All customer orders & seller-wise breakdown</p>
          </div>

          <input
            type="text"
            className="order-search"
            placeholder="Search by order id/ customer/ phone no"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="orders-table-wrapper">

          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  {/* 1. Main Order Header Row */}
                  <tr className="main-order-row">
                    <td><strong>#ORD-{order.id}</strong></td>
                    <td>{order.customerName}</td>
                    <td>{order.user?.phone || "-"}</td>
                    <td>₹{order.grandTotal.toLocaleString()}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>

                  {/* 2. Expanded Details Row */}
                  <tr className="order-items-row">
                    <td colSpan="5">
                      <div className="order-details-container">
                        {/* Metadata Bar */}
                        <div className="order-metadata-bar">
                          <span><strong>Payment:</strong> {order.paymentMethod?.toUpperCase()}</span>
                          <span><strong>Address:</strong> {order.address}</span>
                          {order.razorpayPaymentId && (
                            <span><strong>Transaction ID:</strong> {order.razorpayPaymentId}</span>
                          )}
                        </div>

                        {/* Items Table */}
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Seller</th>
                              <th>Qty</th>
                              <th>Price Details</th>
                              <th>Subtotal</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <div className="item-info">
                                    <img src={item.imageUrl || "/placeholder.jpg"} alt="p" className="item-img" />
                                    <span>{item.materialName}</span>
                                  </div>
                                </td>
                                <td>
                                  {item.seller?.name || "Unknown Seller"}<br />
                                  <small className="seller-phone">{item.seller?.phone || "No Phone"}</small>
                                </td>
                                <td>{item.quantity} {item.unit}</td>
                                <td>
                                  <div>₹{item.pricePerUnit}</div>
                                  <small className="shipping-info">
                                    Shipping: {item.shippingChargeType === "Free" ? "FREE" : `₹${item.shippingCharge}`}
                                  </small>
                                </td>
                                <td>₹{item.totalAmount}</td>
                                <td>
                                  <span className={`badge ${item.status === 'fulfilled' ? 'success' : 'pending'}`}>
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="empty-state">No orders found</div>
        )}
      </div>
    </>
  );
};

export default Orders;
