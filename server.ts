import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { User, Booking } from "./src/backend/db.js";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables (reloaded)
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Gemini Client server-side
  const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

  /**
   * API ROUTES
   */

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Get all users (Admin & Drivers)
  app.get("/api/users", async (req, res) => {
    try {
      const users = await User.find();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch users: " + error.message });
    }
  });

  // Auth Login Endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Vui lòng điền đầy đủ Email và Mật khẩu." });
      }

      const user = await User.findOne({ email: email.trim() });
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Email hoặc Mật khẩu không đúng." });
      }

      // Return user without password
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Lỗi đăng nhập hệ thống: " + error.message });
    }
  });

  // Create a new user (Admin or Driver)
  app.post("/api/users", async (req, res) => {
    try {
      const { name, email, phone, role, password } = req.body;

      if (!name || !email || !phone || !role) {
        return res.status(400).json({ error: "Vui lòng điền đầy đủ Họ tên, Email, Số điện thoại và Vai trò." });
      }

      if (role !== "Admin" && role !== "Driver") {
        return res.status(400).json({ error: "Vai trò không hợp lệ. Phải là 'Admin' hoặc 'Driver'." });
      }

      // Check if email already exists
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: "Email này đã được đăng ký trên hệ thống." });
      }

      const newUser = await User.create({
        name,
        email,
        phone,
        role,
        password: password || "123456",
      });

      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(500).json({ error: "Không thể thêm tài khoản: " + error.message });
    }
  });

  // Get all bookings (with optional filter)
  app.get("/api/bookings", async (req, res) => {
    try {
      const { status, driver_id } = req.query;
      const filter: any = {};
      if (status) filter.status = status;
      if (driver_id) filter.driver_id = driver_id;

      const bookings = await Booking.find(filter);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch bookings: " + error.message });
    }
  });

  // Get a single booking
  app.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch booking: " + error.message });
    }
  });

  // Create a new booking
  app.post("/api/bookings", async (req, res) => {
    try {
      const {
        customer_name,
        customer_phone,
        customer_email,
        flight_number,
        airport_terminal,
        pickup_pillar,
        dropoff_address,
        luggage_count,
        payment_method,
        selected_vehicle,
        estimated_distance,
        estimated_price,
      } = req.body;

      if (!customer_name || !customer_phone || !dropoff_address) {
        return res.status(400).json({ error: "Missing required passenger name, phone, or destination address for booking." });
      }

      const newBooking = await Booking.create({
        customer_name,
        customer_phone,
        customer_email: customer_email || "",
        flight_number: flight_number || "N/A",
        airport_terminal: airport_terminal || "N/A",
        pickup_pillar: pickup_pillar || "",
        dropoff_address,
        luggage_count: Number(luggage_count) || 0,
        payment_method: payment_method || "Cash to Driver",
        selected_vehicle: selected_vehicle || "Standard Luxury Sedan",
        status: "Pending",
        driver_id: null,
        estimated_distance: estimated_distance ? Number(estimated_distance) : undefined,
        estimated_price: estimated_price ? Number(estimated_price) : undefined,
      });

      res.status(201).json(newBooking);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create booking: " + error.message });
    }
  });

  // Create Stripe Checkout Session endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, bookingId, description } = req.body;
      if (!amount || !bookingId) {
        return res.status(400).json({ error: "Missing amount or bookingId" });
      }

      const amountInCents = Math.round(Number(amount) * 100);
      const origin = req.get("origin") || "http://localhost:3000";

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(500).json({ error: "Stripe Secret Key is not configured on the server." });
      }

      const params = new URLSearchParams();
      params.append("payment_method_types[0]", "card");
      params.append("line_items[0][price_data][currency]", "usd");
      params.append("line_items[0][price_data][product_data][name]", "Dịch vụ đặt xe đưa đón (TriShuttle)");
      params.append("line_items[0][price_data][product_data][description]", description || "Tính toán dựa trên lộ trình của bạn");
      params.append("line_items[0][price_data][unit_amount]", amountInCents.toString());
      params.append("line_items[0][quantity]", "1");
      params.append("mode", "payment");
      params.append("success_url", `${origin}/?payment=success&bookingId=${bookingId}`);
      params.append("cancel_url", `${origin}/?payment=cancel&bookingId=${bookingId}`);

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Stripe API error response:", errorText);
        return res.status(500).json({ error: `Stripe API error: ${response.statusText}` });
      }

      const session = await response.json();
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Create Checkout Session exception:", error);
      res.status(500).json({ error: "Internal server error: " + error.message });
    }
  });

  // Update a booking (e.g. status dispatch, assign driver, change pillar)
  app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const { status, driver_id, pickup_pillar, dropoff_address, luggage_count } = req.body;
      const bookingId = req.params.id;

      const existing = await Booking.findById(bookingId);
      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (driver_id !== undefined) updates.driver_id = driver_id === "" ? null : driver_id;
      if (pickup_pillar !== undefined) updates.pickup_pillar = pickup_pillar;
      if (dropoff_address !== undefined) updates.dropoff_address = dropoff_address;
      if (luggage_count !== undefined) updates.luggage_count = Number(luggage_count);

      const updated = await Booking.findByIdAndUpdate(bookingId, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update booking: " + error.message });
    }
  });

  // Delete a booking
  app.delete("/api/bookings/:id", async (req, res) => {
    try {
      const deleted = await Booking.deleteOne(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json({ success: true, message: "Booking deleted successfully." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete booking: " + error.message });
    }
  });

  // AI-powered flight check & validation endpoint (using Gemini 3.5 Flash)
  app.post("/api/validate-flight", async (req, res) => {
    try {
      const { flightNumber } = req.body;
      if (!flightNumber) {
        return res.status(400).json({ error: "Flight number cannot be empty." });
      }

      if (!ai) {
        // High-quality fallback if GEMINI_API_KEY is not defined yet
        return res.json({
          valid: true,
          airline: "Airline (Simulated)",
          terminal: "Tom Bradley International Terminal (TBIT)",
          notes: "Note: To enable real-time automatic AI flight check, please configure GEMINI_API_KEY. Currently, the system is automatically estimating a valid schedule for LAX airport.",
        });
      }

      const prompt = `You are a professional aviation information analysis AI for airport shuttle services at LAX (Los Angeles International Airport). 
Please check this flight number: "${flightNumber}". 
Requirements:
1. Determine if the flight number format is valid.
2. Find the name of the Airline operating this flight.
3. Determine the typical arrival terminal for this airline at LAX airport (e.g. Tom Bradley International Terminal, Terminal 4, Terminal 7, etc.).
4. Write a detailed summary and advice in English (notes) analyzing the typical origin of the flight, the best passenger pickup location/pillar instructions for the driver, and any travel time advice.
The output must strictly comply with the defined JSON structure.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              valid: {
                type: Type.BOOLEAN,
                description: "True if flight number format is valid, False otherwise.",
              },
              airline: {
                type: Type.STRING,
                description: "Full name of the airline (e.g. Vietnam Airlines, Japan Airlines, American Airlines).",
              },
              terminal: {
                type: Type.STRING,
                description: "Typical arrival terminal at LAX (e.g. Tom Bradley International Terminal (TBIT), Terminal 4, Terminal 6, etc.).",
              },
              notes: {
                type: Type.STRING,
                description: "Detailed analysis, recommendations and pickup instructions in English for the driver and dispatchers regarding this flight.",
              },
            },
            required: ["valid", "airline", "terminal", "notes"],
          },
        },
      });

      const parsedResult = JSON.parse(response.text || "{}");
      res.json(parsedResult);
    } catch (error: any) {
      console.error("Gemini flight validation error:", error);
      res.status(500).json({ error: "Lỗi phân tích mã chuyến bay qua AI: " + error.message });
    }
  });

  /**
   * VITE OR STATIC SERVING MIDDLEWARE
   */
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[test Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
