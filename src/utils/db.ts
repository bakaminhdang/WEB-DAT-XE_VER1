import { IBooking, IUser } from "../types";

// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Default Seed Data
const defaultUsers: IUser[] = [
  {
    _id: "admin_seed_id",
    name: "Tri Shuttle Admin",
    email: "admin@trishuttle.com",
    phone: "+1 800-555-0100",
    role: "Admin",
    password: "admin123",
  },
  {
    _id: "driver_john_miller",
    name: "John Miller",
    email: "john.miller@trishuttle.com",
    phone: "+1 714-555-0192",
    role: "Driver",
    password: "driver123",
  },
  {
    _id: "driver_robert_chen",
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
    driver_id: "driver_john_miller",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

// Load and save state
function loadState(): { users: IUser[]; bookings: IBooking[] } {
  try {
    const usersStr = localStorage.getItem("tri_shuttle_users");
    const bookingsStr = localStorage.getItem("tri_shuttle_bookings");

    let users = usersStr ? JSON.parse(usersStr) : null;
    let bookings = bookingsStr ? JSON.parse(bookingsStr) : null;

    if (!users) {
      users = defaultUsers;
      localStorage.setItem("tri_shuttle_users", JSON.stringify(users));
    }
    if (!bookings) {
      bookings = defaultBookings;
      localStorage.setItem("tri_shuttle_bookings", JSON.stringify(bookings));
    }

    return { users, bookings };
  } catch (error) {
    console.error("Error loading state from localStorage:", error);
    return { users: defaultUsers, bookings: defaultBookings };
  }
}

function saveState(users: IUser[], bookings: IBooking[]) {
  try {
    localStorage.setItem("tri_shuttle_users", JSON.stringify(users));
    localStorage.setItem("tri_shuttle_bookings", JSON.stringify(bookings));
  } catch (error) {
    console.error("Error saving state to localStorage:", error);
  }
}

// Database API Methods (Client-Side)
export const getBookings = async (): Promise<IBooking[]> => {
  const { bookings } = loadState();
  return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getUsers = async (): Promise<IUser[]> => {
  const { users } = loadState();
  return users;
};

export const loginUser = async (email: string, password: string): Promise<IUser> => {
  const { users } = loadState();
  const user = users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  
  if (!user || user.password !== password) {
    throw new Error("Email hoặc Mật khẩu không đúng.");
  }
  
  // Return user details without password for security
  const { password: _, ...safeUser } = user;
  return safeUser as IUser;
};

export const createUser = async (userData: Omit<IUser, "_id">): Promise<IUser> => {
  const { users, bookings } = loadState();
  
  const existing = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
  if (existing) {
    throw new Error("Email này đã được đăng ký trên hệ thống.");
  }

  const newUser: IUser = {
    _id: "user_" + generateId(),
    ...userData,
    password: userData.password || "123456",
  };

  users.push(newUser);
  saveState(users, bookings);
  
  const { password: _, ...safeUser } = newUser;
  return safeUser as IUser;
};

export const createBooking = async (
  bookingData: Omit<IBooking, "_id" | "createdAt" | "updatedAt">
): Promise<IBooking> => {
  const { users, bookings } = loadState();
  
  const now = new Date().toISOString();
  const newBooking: IBooking = {
    _id: "booking_" + generateId(),
    ...bookingData,
    createdAt: now,
    updatedAt: now,
  };

  bookings.push(newBooking);
  saveState(users, bookings);
  return newBooking;
};

export const updateBooking = async (
  id: string,
  updates: Partial<Omit<IBooking, "_id" | "createdAt" | "updatedAt">>
): Promise<IBooking> => {
  const { users, bookings } = loadState();
  const index = bookings.findIndex((b) => b._id === id);
  if (index === -1) {
    throw new Error("Booking not found");
  }

  const updatedBooking = {
    ...bookings[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  bookings[index] = updatedBooking;
  saveState(users, bookings);
  return updatedBooking;
};

export const deleteBooking = async (id: string): Promise<boolean> => {
  const { users, bookings } = loadState();
  const initialLength = bookings.length;
  const filteredBookings = bookings.filter((b) => b._id !== id);
  
  if (filteredBookings.length === initialLength) {
    throw new Error("Booking not found");
  }

  saveState(users, filteredBookings);
  return true;
};

// Client-Side AI Flight Validation Simulation
export const validateFlightAI = async (
  flightNumber: string
): Promise<{ valid: boolean; airline: string; terminal: string; notes: string }> => {
  const fn = flightNumber.trim().toUpperCase();
  if (!fn) {
    throw new Error("Flight number cannot be empty.");
  }

  // Artificial delay to make it feel like a real AI processing call
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (fn.startsWith("VN")) {
    return {
      valid: true,
      airline: "Vietnam Airlines",
      terminal: "Tom Bradley International Terminal (TBIT)",
      notes: "Direct or transit flight arriving at Tom Bradley International Terminal (TBIT). The passenger will exit from the international arrivals exit. It is recommended that the driver wait near Pillar 4B at the arrival level.",
    };
  }

  if (fn.startsWith("AA")) {
    return {
      valid: true,
      airline: "American Airlines",
      terminal: "Terminal 4 / Terminal 5",
      notes: "Domestic or international flight operated by American Airlines. The passenger should be picked up at the curb outside Terminal 4. Suggest coordinate with the driver to park at Pillar 2A.",
    };
  }

  if (fn.startsWith("SQ")) {
    return {
      valid: true,
      airline: "Singapore Airlines",
      terminal: "Tom Bradley International Terminal (TBIT)",
      notes: "Long-haul flight from Singapore (SIN) arriving at Tom Bradley Terminal. Recommend picking up passenger at Pillar 4B or 4C on the lower arrivals level.",
    };
  }

  if (fn.startsWith("CX")) {
    return {
      valid: true,
      airline: "Cathay Pacific",
      terminal: "Tom Bradley International Terminal (TBIT)",
      notes: "Flight from Hong Kong (HKG) arriving at Tom Bradley Terminal. Suggest driver wait at international arrivals exit, Pillar 3A/3B.",
    };
  }

  if (fn.startsWith("KE")) {
    return {
      valid: true,
      airline: "Korean Air",
      terminal: "Tom Bradley International Terminal (TBIT)",
      notes: "Flight from Seoul (ICN) arriving at Tom Bradley Terminal. Passenger exits international arrivals. Meet at Pillar 4B.",
    };
  }

  if (fn.startsWith("NH") || fn.startsWith("JL")) {
    return {
      valid: true,
      airline: fn.startsWith("NH") ? "All Nippon Airways" : "Japan Airlines",
      terminal: "Tom Bradley International Terminal (TBIT)",
      notes: "Flight from Tokyo arriving at Tom Bradley Terminal. Recommend international arrivals exit, Pillar 4B.",
    };
  }

  // General format match
  const flightNumberRegex = /^[A-Z]{2,3}\d{1,4}$/;
  const isValidFormat = flightNumberRegex.test(fn);

  if (isValidFormat) {
    return {
      valid: true,
      airline: "Scheduled Carrier (Detected)",
      terminal: "Tom Bradley International Terminal (TBIT) / Terminal 6",
      notes: "Valid flight format. Estimated arrival at LAX. Driver should coordinate with the passenger directly via message or phone upon landing. Suggested pickup location is at arrivals curb.",
    };
  } else {
    return {
      valid: false,
      airline: "Unknown Airline",
      terminal: "Unknown",
      notes: "Warning: The flight number format is unusual. Please double-check with the passenger to ensure the correct flight number and airline details.",
    };
  }
};
