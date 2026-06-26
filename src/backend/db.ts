import fs from "fs";
import path from "path";

// Define the file-based database path
const DB_FILE = path.join(process.cwd(), "db.json");

export interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "Admin" | "Driver";
  password?: string;
}

export interface IBooking {
  _id: string;
  customer_name: string;
  customer_phone: string;
  flight_number: string;
  airport_terminal: string;
  pickup_pillar?: string;
  dropoff_address: string;
  luggage_count: number;
  customer_email?: string;
  payment_method?: string;
  selected_vehicle?: string;
  status: "Pending" | "Active" | "Completed" | "Cancelled";
  driver_id: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IDatabaseSchema {
  users: IUser[];
  bookings: IBooking[];
}

// Global database state in memory, synchronized with db.json
let dbState: IDatabaseSchema = {
  users: [],
  bookings: [],
};

// Helper to load DB
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      dbState = JSON.parse(data);
    } else {
      initializeSeedData();
    }
  } catch (error) {
    console.error("Error loading file-based database, initializing default empty structure", error);
    dbState = { users: [], bookings: [] };
  }
}

// Helper to save DB
function saveDB() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving database file", error);
  }
}

// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Initialize Seed Data
function initializeSeedData() {
  const adminId = "admin_" + generateId();
  const johnMillerId = "driver_john_miller";
  const robertChenId = "driver_robert_chen";

  const defaultUsers: IUser[] = [
    {
      _id: adminId,
      name: "test Admin",
      email: "admin@trishuttle.com",
      phone: "+1 800-555-0100",
      role: "Admin",
      password: "admin123",
    },
    {
      _id: johnMillerId,
      name: "John Miller",
      email: "john.miller@trishuttle.com",
      phone: "+1 714-555-0192",
      role: "Driver",
      password: "driver123",
    },
    {
      _id: robertChenId,
      name: "Robert Chen",
      email: "robert.chen@trishuttle.com",
      phone: "+1 949-555-0143",
      role: "Driver",
      password: "driver123",
    },
  ];

  const defaultBookings: IBooking[] = [
    {
      _id: "booking_1",
      customer_name: "Thu Anh Nguyen",
      customer_phone: "+84 901234567",
      flight_number: "VN521",
      airport_terminal: "Tom Bradley International Terminal",
      pickup_pillar: "Pillar 4B",
      dropoff_address: "Westminster, California (Little Saigon)",
      luggage_count: 3,
      status: "Pending",
      driver_id: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      _id: "booking_2",
      customer_name: "David Thomson",
      customer_phone: "+1 213-555-9876",
      flight_number: "AA2412",
      airport_terminal: "Terminal 4",
      pickup_pillar: "Pillar 2A",
      dropoff_address: "Irvine, California",
      luggage_count: 1,
      status: "Active",
      driver_id: johnMillerId,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ];

  dbState = {
    users: defaultUsers,
    bookings: defaultBookings,
  };
  saveDB();
}

// Boot up the DB
loadDB();

/**
 * MongoDB / Mongoose-like ODM Wrapper
 */
export const User = {
  find: async (filter: Partial<IUser> = {}) => {
    loadDB();
    return dbState.users.filter((u) => {
      for (const key in filter) {
        if (u[key as keyof IUser] !== filter[key as keyof IUser]) {
          return false;
        }
      }
      return true;
    });
  },

  findOne: async (filter: Partial<IUser>) => {
    loadDB();
    return dbState.users.find((u) => {
      for (const key in filter) {
        if (u[key as keyof IUser] !== filter[key as keyof IUser]) {
          return false;
        }
      }
      return true;
    }) || null;
  },

  findById: async (id: string) => {
    loadDB();
    return dbState.users.find((u) => u._id === id) || null;
  },

  create: async (userData: Omit<IUser, "_id">) => {
    loadDB();
    const newUser: IUser = {
      _id: "user_" + generateId(),
      ...userData,
    };
    dbState.users.push(newUser);
    saveDB();
    return newUser;
  },
};

export const Booking = {
  find: async (filter: Partial<IBooking> = {}) => {
    loadDB();
    return dbState.bookings.filter((b) => {
      for (const key in filter) {
        if (b[key as keyof IBooking] !== filter[key as keyof IBooking]) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  findOne: async (filter: Partial<IBooking>) => {
    loadDB();
    return dbState.bookings.find((b) => {
      for (const key in filter) {
        if (b[key as keyof IBooking] !== filter[key as keyof IBooking]) {
          return false;
        }
      }
      return true;
    }) || null;
  },

  findById: async (id: string) => {
    loadDB();
    return dbState.bookings.find((b) => b._id === id) || null;
  },

  create: async (bookingData: Omit<IBooking, "_id" | "createdAt" | "updatedAt">) => {
    loadDB();
    const now = new Date().toISOString();
    const newBooking: IBooking = {
      _id: "booking_" + generateId(),
      ...bookingData,
      createdAt: now,
      updatedAt: now,
    };
    dbState.bookings.push(newBooking);
    saveDB();
    return newBooking;
  },

  findByIdAndUpdate: async (
    id: string,
    updates: Partial<Omit<IBooking, "_id" | "createdAt" | "updatedAt">>,
    options: { new?: boolean } = { new: true }
  ) => {
    loadDB();
    const index = dbState.bookings.findIndex((b) => b._id === id);
    if (index === -1) return null;

    const oldBooking = dbState.bookings[index];
    const updatedBooking: IBooking = {
      ...oldBooking,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    dbState.bookings[index] = updatedBooking;
    saveDB();
    return updatedBooking;
  },

  deleteOne: async (id: string) => {
    loadDB();
    const initialLength = dbState.bookings.length;
    dbState.bookings = dbState.bookings.filter((b) => b._id !== id);
    saveDB();
    return dbState.bookings.length < initialLength;
  }
};
