import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs"; // Use bcryptjs as you installed it earlier
import transporter from "./utils/transporter.js"; // Note the .js extension for ES Modules

dotenv.config();

const app = express();
const prisma = new PrismaClient();

/* ======================
   MIDDLEWARE
====================== */
app.use(
  cors({
    origin: "http://localhost:4000", // Admin frontend
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(express.json());

/* ======================
   HEALTH
====================== */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "admin-backend" });
});

/* ======================
   DASHBOARD
====================== */
// admin/dashboard (replace existing route implementation)
app.get("/admin/dashboard", async (req, res) => {
  try {
    // base counts
    const [
      totalUsers,
      totalSellers,
      totalDesigners,
      totalOrders,
      completedRefunds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.seller.count(),
      prisma.designer.count(),
      prisma.order.count(),
      prisma.returnRequest.count({ where: { refundStatus: "COMPLETED" } }),
    ]);

    // === returnsByStatus (your existing logic) ===
    const allReturns = await prisma.returnRequest.findMany({
      select: { sellerApprovalStatus: true, adminApprovalStatus: true },
    });

    const pendingReturns = allReturns.filter(
      (r) =>
        r.sellerApprovalStatus === "PENDING" ||
        r.adminApprovalStatus === "PENDING"
    ).length;

    const returnsByStatus = [
      {
        name: "REQUESTED",
        value: allReturns.filter((r) => r.adminApprovalStatus === "PENDING")
          .length,
      },
      {
        name: "APPROVED",
        value: allReturns.filter(
          (r) =>
            r.sellerApprovalStatus === "APPROVED" &&
            r.adminApprovalStatus === "APPROVED"
        ).length,
      },
      {
        name: "REJECTED",
        value: allReturns.filter(
          (r) =>
            r.sellerApprovalStatus === "REJECTED" ||
            r.adminApprovalStatus === "REJECTED"
        ).length,
      },
    ];

    // === completedOrders ===
    // "Completed" = orders where EVERY order item has status === 'fulfilled'.
    // If you want "any item fulfilled" instead, change `every` to `some`.
    const completedOrders = await prisma.order.count({
      where: {
        items: {
          every: { status: "fulfilled" },
        },
      },
    });

    // === ordersOverTime (last 30 days) ===
    const SINCE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: SINCE } },
      select: { createdAt: true, grandTotal: true },
      orderBy: { createdAt: "asc" },
    });

    // aggregate per-day (YYYY-MM-DD)
    const map = {};
    recentOrders.forEach((o) => {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (!map[day]) map[day] = { date: day, orders: 0, revenue: 0 };
      map[day].orders += 1;
      map[day].revenue += Number(o.grandTotal ?? 0);
    });
    const ordersOverTime = Object.values(map);

    // === platformMix: small sample to populate pie chart ===
    const platformMix = [
      { name: "Users", value: totalUsers },
      { name: "Sellers", value: totalSellers },
      { name: "Designers", value: totalDesigners },
    ];

    res.json({
      stats: {
        totalUsers,
        totalSellers,
        totalDesigners,
        totalOrders,
        pendingReturns,
        completedRefunds,
        completedOrders, // new
      },
      ordersOverTime,
      returnsByStatus,
      platformMix,
    });
  } catch (err) {
    console.error("❌ DASHBOARD ERROR:", err);
    res.status(500).json({ error: "Dashboard load failed" });
  }
});




/* ======================
   USERS
====================== */
app.get("/admin/users", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      credit: true,
      createdAt: true,
    },
  });

  res.json(users);
});

app.get("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: true,
      returnRequests: {
        select: {
          id: true,
          productName: true,
          reason: true,
          sellerApprovalStatus: true,
          adminApprovalStatus: true,
          refundStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
});

/* ======================
   SELLERS
====================== */
app.get("/admin/sellers", async (req, res) => {
  const sellers = await prisma.seller.findMany({
    include: {
      business: true,
      delivery: true,
      bank: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    sellers.map((s) => ({
      id: s.id,
      ownerName: s.name,
      businessName: s.business?.businessName || "-",
      email: s.email,
      phone: s.phone,
      city: s.business?.city || "-",
      // Updated: Use isVerified for status
      status: s.isVerified ? "VERIFIED" : "PENDING",
      joinedAt: s.createdAt,
    }))
  );
});

app.patch("/admin/designers/:id/verify", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isVerified } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    // 1. Update the designer's verification status
    const updatedDesigner = await prisma.designer.update({
      where: { id },
      data: { isVerified: isVerified },
    });

    // 2. Send Congratulations Email only if status is true
    if (updatedDesigner.isVerified) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: updatedDesigner.email,
        subject: "Your Professional Profile is Verified! | Core2Cover",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; padding: 25px; border-radius: 12px; border-top: 5px solid #000;">
            <h2 style="color: #1a1a1a;">Welcome to the Core2Cover Community!</h2>
            <p>Hello ${updatedDesigner.fullname || 'Designer'},</p>
            <p>Your professional profile has been **Verified**. You now have full access to our platform's designer features.</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0;">What you can do now:</h4>
              <ul style="padding-left: 20px;">
                <li>Upload and showcase your portfolio works.</li>
                <li>Receive direct work requests from customers.</li>
                <li>Appear in our "Hire a Designer" search results.</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://core2cover.vercel.app/designerlogin" 
                 style="background-color: #000; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Access Designer Dashboard
              </a>
            </div>

            <p style="font-size: 13px; color: #888;">
              Questions? Reply to this email or reach us at team.core2cover@gmail.com.
            </p>
            <p style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px;">
              Regards,<br/><strong>The Core2Cover Team</strong>
            </p>
          </div>
        `,
      });
    }

    res.json({
      success: true,
      isVerified: updatedDesigner.isVerified
    });
  } catch (err) {
    console.error("❌ DESIGNER VERIFY ERROR:", err);
    res.status(500).json({ error: "Failed to update designer verification" });
  }
});

/* ======================
   DESIGNERS (ADMIN)
====================== */
app.get("/admin/designers", async (req, res) => {
  try {
    const designers = await prisma.designer.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });

    const formatted = designers.map((d) => ({
      id: d.id,
      fullname: d.fullname,
      email: d.email,
      phone: d.mobile || "-",
      location: d.location || "-",
      experience: d.profile?.experience || "-",
      availability: d.availability?.toUpperCase() === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
      subscriptionStatus: "FREE",
      // Logic: If isVerified is true, status is ACTIVE, else PENDING
      status: d.isVerified ? "ACTIVE" : "PENDING",
      isVerified: d.isVerified,
      createdAt: d.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ ADMIN FETCH DESIGNERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch designers" });
  }
});

/* ======================
   DESIGNER WORK HISTORY (ADMIN)
====================== */
app.get("/admin/designers/:id/work-history", async (req, res) => {
  try {
    const designerId = Number(req.params.id);
    if (isNaN(designerId)) {
      return res.status(400).json({ error: "Invalid designer ID" });
    }

    /* ======================
       FETCH DESIGNER
    ====================== */
    const designer = await prisma.designer.findUnique({
      where: { id: designerId },
      include: {
        profile: {
          select: {
            experience: true,
            profileImage: true, // <--- Ensure this is selected
          }
        },
      },
    });

    if (!designer) {
      return res.status(404).json({ error: "Designer not found" });
    }

    /* ======================
       FETCH PORTFOLIO WORKS
    ====================== */
    const portfolioWorks = await prisma.designerWork.findMany({
      where: { designerId },
      orderBy: { createdAt: "desc" },
    });

    /* ======================
       FETCH PROJECT HISTORY
    ====================== */
    const projectHistoryRaw = await prisma.designerHireRequest.findMany({
      where: { designerId },
      include: {
        rating: true, // designerRating
      },
      orderBy: { createdAt: "desc" },
    });

    const projectHistory = projectHistoryRaw.map((p) => ({
      id: p.id,
      clientName: p.fullName,
      workType: p.workType,
      budget: p.budget,
      status: p.status,
      rating: p.rating?.stars || null,
      createdAt: p.createdAt,
    }));

    /* ======================
       RESPONSE
    ====================== */
    res.json({
      designer: {
        fullname: designer.fullname,
        email: designer.email,
        location: designer.location || "-",
        experience: designer.profile?.experience || "-",
        availability: designer.availability || "UNAVAILABLE",
        profileImage: designer.profile?.profileImage || null,
      },
      portfolioWorks,
      projectHistory,
    });
  } catch (err) {
    console.error("❌ DESIGNER WORK HISTORY ERROR:", err);
    res.status(500).json({ error: "Failed to fetch work history" });
  }
});

// DELETE DESIGNER
app.delete("/admin/designers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Delete related records first if cascade delete is not set in Prisma
    // For example: await prisma.portfolio.deleteMany({ where: { designerId: id } });

    await prisma.designer.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true, message: "Designer deleted successfully" });
  } catch (err) {
    console.error("DELETE DESIGNER ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to delete designer" });
  }
});

/* ======================
   CREATE / UPDATE UPI
====================== */
app.post("/seller/upi", async (req, res) => {
  try {
    const { sellerId, upiId } = req.body;

    if (!sellerId || !upiId) {
      return res.status(400).json({ error: "sellerId and upiId are required" });
    }

    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
      return res.status(400).json({ error: "Invalid UPI format" });
    }

    const upi = await prisma.sellerBankDetails.upsert({
      where: { sellerId },
      update: { upiId },
      create: { sellerId, upiId },
    });

    res.json({ success: true, upi });
  } catch (err) {
    console.error("UPSERT UPI ERROR:", err);
    res.status(500).json({ error: "Failed to save UPI" });
  }
});

/* ======================
   DELETE UPI
====================== */
app.delete("/seller/:id/upi", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);

    await prisma.sellerBankDetails.delete({
      where: { sellerId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE UPI ERROR:", err);
    res.status(500).json({ error: "Failed to delete UPI" });
  }
});



// GET SELLER DETAILS (ADMIN)
app.get("/admin/sellers/:id", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (isNaN(sellerId)) {
      return res.status(400).json({ error: "Invalid seller ID" });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        business: true,
        delivery: true,
        bank: true,
      },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    res.json({
      id: seller.id,
      // Updated logic
      status: seller.isVerified ? "VERIFIED" : "PENDING",
      isVerified: seller.isVerified,

      seller: {
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        createdAt: seller.createdAt,
      },

      business: seller.business,
      delivery: seller.delivery,
      bank: seller.bank,
    });
  } catch (err) {
    console.error("FETCH SELLER DETAILS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch seller details" });
  }
});

// GET SELLER PRODUCTS (ADMIN)
app.get("/admin/sellers/:id/products", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (isNaN(sellerId)) {
      return res.status(400).json({ error: "Invalid seller ID" });
    }

    const products = await prisma.product.findMany({
      where: { sellerId: sellerId },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (err) {
    console.error("FETCH SELLER PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products for this seller" });
  }
});

// admin/products/:id (PATCH)
app.patch("/admin/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, category, productType, price, availability } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        category,
        productType,
        price: parseFloat(price),
        availability
      },
    });

    res.json({ success: true, updated });
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

/* ======================
    VERIFY SELLER (ADMIN)
====================== */
// Ensure this is AFTER your middleware and BEFORE app.listen
app.patch("/admin/sellers/:id/verify", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isVerified } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    // 1. Update the seller status and get their email/name
    const updatedSeller = await prisma.seller.update({
      where: { id },
      data: { isVerified: isVerified },
    });

    // 2. Only send email if the seller was just verified
    if (updatedSeller.isVerified) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM, // Your system email
        to: updatedSeller.email, // The seller's registered email
        subject: "Congratulations! Your Core2Cover Account is Verified",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2e7d32;">Account Verified!</h2>
            <p>Hello ${updatedSeller.name || 'Seller'},</p>
            <p>Great news! Your professional profile has been reviewed and approved by the Core2Cover team.</p>
            <p>You can now log in to your dashboard to list products, manage inventory, and start selling.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://core2cover.vercel.app/sellerlogin" 
                 style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                 Login to Seller Dashboard
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">
              If you have any questions, feel free to reach out to us at team.core2cover@gmail.com.
            </p>
            <p style="margin-top: 20px;">Best regards,<br/><strong>Team Core2Cover</strong></p>
          </div>
        `,
      });
    }

    res.json({
      success: true,
      status: updatedSeller.isVerified ? "VERIFIED" : "PENDING"
    });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    res.status(500).json({ error: "Failed to update verification status" });
  }
});

/* ======================
   ORDERS
====================== */
app.get("/admin/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, phone: true, email: true },
        },
        items: {
          include: { 
            seller: {
              select: { name: true, phone: true } // Get seller contact info
            } 
          },
        },
      },
    });

    res.json(orders);
  } catch (err) {
    console.error("FETCH ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.delete("/admin/orders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Delete order items first (if not handled by cascade delete in schema)
    await prisma.orderItem.deleteMany({
      where: { orderId: parseInt(id) },
    });

    // Delete the main order
    await prisma.order.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

/* ======================
   RETURNS (ADMIN)
====================== */
app.get("/admin/returns", async (req, res) => {
  try {
    const returns = await prisma.returnRequest.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true, // ✅
          },
        },
        orderItem: {
          select: {
            sellerId: true,
            seller: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = returns.map((r) => {
      let derivedStatus = "REQUESTED";

      if (r.adminApprovalStatus === "REJECTED") {
        derivedStatus = "REJECTED";
      } else if (
        r.sellerApprovalStatus === "APPROVED" &&
        r.adminApprovalStatus === "APPROVED"
      ) {
        derivedStatus = "APPROVED";
      }

      return {
        id: r.id,
        productName: r.productName,

        userName: r.user?.name || "-",
        userMobile: r.user?.phone || "-",

        sellerName: r.orderItem?.seller?.name || "-",

        status: derivedStatus,
        sellerApprovalStatus: r.sellerApprovalStatus,
        adminApprovalStatus: r.adminApprovalStatus,

        refundMethod: r.refundMethod,
        refundAmount: r.refundAmount ?? 0,
        refundStatus: r.refundStatus,

        requestedAt: r.createdAt,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("❌ ADMIN FETCH RETURNS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});



app.patch("/admin/returns/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.returnRequest.update({
      where: { id },
      data: {
        adminApprovalStatus: "APPROVED",
        adminApprovedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN APPROVE ERROR:", err);
    res.status(500).json({ error: "Approve failed" });
  }
});


app.patch("/admin/returns/:id/reject", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.returnRequest.update({
      where: { id },
      data: {
        adminApprovalStatus: "REJECTED",
        adminApprovedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN REJECT ERROR:", err);
    res.status(500).json({ error: "Reject failed" });
  }
});


app.patch("/admin/returns/:id/refund", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const rr = await prisma.returnRequest.findUnique({ where: { id } });
    if (!rr) return res.status(404).json({ error: "Return not found" });

    if (
      rr.sellerApprovalStatus !== "APPROVED" ||
      rr.adminApprovalStatus !== "APPROVED"
    ) {
      return res.status(400).json({
        error: "Seller & Admin must approve first",
      });
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        refundStatus: "COMPLETED",
      },
    });

    res.json({ success: true, updated });
  } catch (err) {
    console.error("REFUND ERROR:", err);
    res.status(500).json({ error: "Refund failed" });
  }
});

/* ======================
   CONTACT MESSAGES (ADMIN)
====================== */
app.get("/admin/contact-messages", async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";

    const messages = await prisma.contactMessage.findMany({
      where: search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { message: { contains: search, mode: "insensitive" } },
          ],
        }
        : undefined,

      orderBy: { createdAt: "desc" },
    });

    res.json(messages);
  } catch (err) {
    console.error("❌ FETCH CONTACT MESSAGES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});



/* ======================
   SERVER
====================== */
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Admin server running on http://localhost:${PORT}`);
});
