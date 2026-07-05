import React, { useState, useEffect } from "react";
import { IBooking, IUser } from "../types";
import { validateFlightAI } from "../utils/db";
import { 
  Plane, 
  User, 
  MapPin, 
  Briefcase, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Check, 
  Clock, 
  Sparkles, 
  Filter, 
  AlertTriangle, 
  RefreshCw,
  Trash2,
  Edit,
  Calendar
} from "lucide-react";

interface AdminViewProps {
  bookings: IBooking[];
  users: IUser[];
  onUpdateBooking: (id: string, updates: Partial<IBooking>) => Promise<void>;
  onDeleteBooking: (id: string) => Promise<void>;
  onCreateUser: (user: Omit<IUser, "_id">) => Promise<void>;
  onRefresh: () => void;
}

const renderAddressLinks = (addressStr: string) => {
  if (addressStr.includes(" -> ")) {
    const parts = addressStr.split(" -> ");
    const pickup = parts[0];
    const dropoff = parts[1];
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
          title="Xem vị trí đón trên Google Maps"
        >
          {pickup}
        </a>
        <span className="text-slate-400 font-normal">➔</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoff)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
          title="Xem vị trí đến trên Google Maps"
        >
          {dropoff}
        </a>
      </span>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 hover:underline"
      title="Xem trên Google Maps"
    >
      {addressStr}
    </a>
  );
};

const parseRoute = (address: string) => {
  if (address.includes("->")) {
    const parts = address.split("->");
    return {
      pickup: parts[0]?.trim() || "",
      dropoff: parts[1]?.trim() || "",
    };
  }
  return {
    pickup: "",
    dropoff: address.trim(),
  };
};

const parsePickupPillarInfo = (pillarText: string) => {
  const complexMatch = pillarText.match(/Pillar:\s*([^(]*)\(Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*@\s*([^,]*),\s*Pax:\s*([0-9]+),\s*Child Seats:\s*([0-9]+)\)/i);
  if (complexMatch) {
    return {
      isAirport: true,
      pillar: complexMatch[1].trim(),
      date: complexMatch[2],
      time: complexMatch[3].trim(),
      pax: parseInt(complexMatch[4], 10),
      childSeats: parseInt(complexMatch[5], 10)
    };
  }

  const simpleMatch = pillarText.match(/Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*@\s*([^,]*),\s*Pax:\s*([0-9]+),\s*Child Seats:\s*([0-9]+)/i);
  if (simpleMatch) {
    return {
      isAirport: false,
      pillar: "",
      date: simpleMatch[1],
      time: simpleMatch[2].trim(),
      pax: parseInt(simpleMatch[3], 10),
      childSeats: parseInt(simpleMatch[4], 10)
    };
  }

  return {
    isAirport: false,
    pillar: pillarText,
    date: "",
    time: "",
    pax: 1,
    childSeats: 0
  };
};

const isBookingDateInPast = (booking: IBooking): { inPast: boolean; dateStr: string } => {
  const pillarText = booking.pickup_pillar || "";
  const match = pillarText.match(/Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})(?:\s*@\s*([0-9]{1,2}):([0-9]{2})\s*(AM|PM))?/i);
  if (match) {
    const dateStr = match[1];
    let hour = match[2] ? parseInt(match[2], 10) : 0;
    const min = match[3] ? parseInt(match[3], 10) : 0;
    const period = match[4] ? match[4].toUpperCase() : "";

    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const bookingDate = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`);
    const now = new Date();
    return { inPast: bookingDate < now, dateStr: `${dateStr}${match[2] ? ` @ ${match[2]}:${match[3]} ${period}` : ""}` };
  }
  return { inPast: false, dateStr: "" };
};

const getBookingDateComponents = (booking: IBooking) => {
  const pillarText = booking.pickup_pillar || "";
  const match = pillarText.match(/Date:\s*([0-9]{4})-([0-9]{2})-([0-9]{2})/i);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: `${match[1]}-${match[2]}`, // "YYYY-MM"
      day: `${match[1]}-${match[2]}-${match[3]}`, // "YYYY-MM-DD"
    };
  }
  // Fallback to createdAt if no date in pickup_pillar
  if (booking.createdAt) {
    const d = new Date(booking.createdAt);
    if (!isNaN(d.getTime())) {
      const yStr = d.getFullYear().toString();
      const mStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const dStr = d.getDate().toString().padStart(2, '0');
      return {
        year: d.getFullYear(),
        month: `${yStr}-${mStr}`,
        day: `${yStr}-${mStr}-${dStr}`,
      };
    }
  }
  return null;
};

export default function AdminView({ bookings, users, onUpdateBooking, onDeleteBooking, onCreateUser, onRefresh }: AdminViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [scheduleFilterMode, setScheduleFilterMode] = useState<"All" | "Day" | "Month" | "Year">("All");
  const [schedDay, setSchedDay] = useState<string>(new Date().toLocaleDateString("en-CA"));
  const [schedMonth, setSchedMonth] = useState<string>(new Date().toLocaleDateString("en-CA").substring(0, 7));
  const [schedYear, setSchedYear] = useState<number>(new Date().getFullYear());
  const [aiCheckingId, setAiCheckingId] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, { valid: boolean; airline: string; terminal: string; notes: string }>>({});
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [pillarInputs, setPillarInputs] = useState<Record<string, string>>({});
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Booking edit states
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    
    // Route
    pickup_address: "",
    dropoff_address: "",
    
    // Flight & Airport
    is_airport_pickup: false,
    flight_number: "",
    airport_terminal: "",
    airport_pillar: "",
    
    // Date & Time & Pax
    pickup_date: "",
    pickup_time: "",
    passengers: 1,
    child_seats: 0,
    
    // Service & Pricing
    luggage_count: 0,
    selected_vehicle: "",
    payment_method: "",
    estimated_distance: "",
    estimated_price: "",
    status: "Pending" as IBooking["status"]
  });

  const handleStartEdit = (booking: IBooking) => {
    const route = parseRoute(booking.dropoff_address || "");
    const pickupInfo = parsePickupPillarInfo(booking.pickup_pillar || "");
    const isAirport = (booking.airport_terminal && booking.airport_terminal !== "N/A") || pickupInfo.isAirport;

    setEditingBooking(booking);
    setEditForm({
      customer_name: booking.customer_name || "",
      customer_phone: booking.customer_phone || "",
      customer_email: booking.customer_email || "",
      
      pickup_address: route.pickup || (isAirport ? "LAX Airport" : ""),
      dropoff_address: route.dropoff,
      
      is_airport_pickup: isAirport,
      flight_number: booking.flight_number === "N/A" ? "" : (booking.flight_number || ""),
      airport_terminal: booking.airport_terminal === "N/A" ? "" : (booking.airport_terminal || ""),
      airport_pillar: pickupInfo.pillar,
      
      pickup_date: pickupInfo.date || new Date().toISOString().split('T')[0],
      pickup_time: pickupInfo.time || "12:00 PM",
      passengers: pickupInfo.pax || 1,
      child_seats: pickupInfo.childSeats || 0,
      
      luggage_count: booking.luggage_count || 0,
      selected_vehicle: booking.selected_vehicle || "",
      payment_method: booking.payment_method || "",
      estimated_distance: booking.estimated_distance !== undefined ? booking.estimated_distance.toString() : "",
      estimated_price: booking.estimated_price !== undefined ? booking.estimated_price.toString() : "",
      status: booking.status
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setIsUpdatingId(editingBooking._id);
    setErrorMessage("");
    try {
      let finalRoute = editForm.dropoff_address.trim();
      if (editForm.pickup_address.trim()) {
        finalRoute = `${editForm.pickup_address.trim()} -> ${editForm.dropoff_address.trim()}`;
      }

      let finalPillar = "";
      const timeStr = editForm.pickup_time || "12:00 PM";
      const dateStr = editForm.pickup_date || new Date().toISOString().split('T')[0];
      
      if (editForm.is_airport_pickup) {
        finalPillar = `Pillar: ${editForm.airport_pillar.trim() || "TBD"} (Date: ${dateStr} @ ${timeStr}, Pax: ${editForm.passengers}, Child Seats: ${editForm.child_seats})`;
      } else {
        finalPillar = `Date: ${dateStr} @ ${timeStr}, Pax: ${editForm.passengers}, Child Seats: ${editForm.child_seats}`;
      }

      const updates: Partial<IBooking> = {
        customer_name: editForm.customer_name.trim(),
        customer_phone: editForm.customer_phone.trim(),
        customer_email: editForm.customer_email.trim(),
        flight_number: editForm.is_airport_pickup ? editForm.flight_number.trim() : "N/A",
        airport_terminal: editForm.is_airport_pickup ? editForm.airport_terminal.trim() : "N/A",
        pickup_pillar: finalPillar,
        dropoff_address: finalRoute,
        luggage_count: Number(editForm.luggage_count),
        selected_vehicle: editForm.selected_vehicle,
        payment_method: editForm.payment_method,
        estimated_distance: editForm.estimated_distance ? Number(editForm.estimated_distance) : undefined,
        estimated_price: editForm.estimated_price ? Number(editForm.estimated_price) : undefined,
        status: editForm.status
      };
      await onUpdateBooking(editingBooking._id, updates);
      setEditingBooking(null);
    } catch (err: any) {
      setErrorMessage("Save edit error: " + err.message);
    } finally {
      setIsUpdatingId(null);
    }
  };

  // User creation states
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Admin" | "Driver">("Driver");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userSuccessMessage, setUserSuccessMessage] = useState("");

  const drivers = users.filter((u) => u.role === "Driver");

  // Pre-populate dropdown drivers and pillar inputs when bookings load
  useEffect(() => {
    const initialDrivers: Record<string, string> = {};
    const initialPillars: Record<string, string> = {};
    bookings.forEach((b) => {
      if (b.driver_id) {
        initialDrivers[b._id] = b.driver_id;
      } else if (drivers.length > 0) {
        // Default to first available driver
        initialDrivers[b._id] = drivers[0]._id;
      }
      initialPillars[b._id] = b.pickup_pillar || "";
    });
    setSelectedDrivers(initialDrivers);
    setPillarInputs(initialPillars);
  }, [bookings, users]);

  // Handle Dispatch / Approval
  const handleDispatch = async (booking: IBooking) => {
    const driverId = selectedDrivers[booking._id];
    const pillar = pillarInputs[booking._id];

    if (!driverId) {
      alert("Please select a driver to assign to this booking.");
      return;
    }

    setIsUpdatingId(booking._id);
    setErrorMessage("");
    try {
      await onUpdateBooking(booking._id, {
        status: "Active",
        driver_id: driverId,
        pickup_pillar: pillar || booking.pickup_pillar || "Pillar not specified",
      });
    } catch (err: any) {
      setErrorMessage("Dispatch error: " + err.message);
    } finally {
      setIsUpdatingId(null);
    }
  };

  // Quick state update (e.g. Complete, Cancel, Pending)
  const handleStatusUpdate = async (id: string, newStatus: IBooking["status"]) => {
    setIsUpdatingId(id);
    setErrorMessage("");
    try {
      await onUpdateBooking(id, { status: newStatus });
    } catch (err: any) {
      setErrorMessage("Status update error: " + err.message);
    } finally {
      setIsUpdatingId(null);
    }
  };

  // Run AI Flight Validation via backend Gemini API
  const handleCheckFlightAI = async (booking: IBooking) => {
    setAiCheckingId(booking._id);
    setErrorMessage("");
    try {
      const data = await validateFlightAI(booking.flight_number);
      setAiResults((prev) => ({
        ...prev,
        [booking._id]: data,
      }));
    } catch (err: any) {
      setErrorMessage("Flight analysis error: " + err.message);
    } finally {
      setAiCheckingId(null);
    }
  };

  // Handle creating a new user account (Driver or Admin)
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPhone.trim() || !newUserRole) {
      setErrorMessage("Please fill in all required fields to create a new user.");
      return;
    }

    setIsCreatingUser(true);
    setErrorMessage("");
    setUserSuccessMessage("");

    try {
      await onCreateUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        phone: newUserPhone.trim(),
        role: newUserRole,
        password: newUserPassword.trim() || "123456",
      });

      setUserSuccessMessage(`Successfully registered ${newUserRole === "Admin" ? "Administrator" : "Driver"} account: ${newUserName}`);
      
      // Clear fields
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPhone("");
      setNewUserPassword("");
      setNewUserRole("Driver");
      
      setTimeout(() => {
        setUserSuccessMessage("");
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Error creating user account.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    // 1. Status Filter
    if (filterStatus !== "All" && b.status !== filterStatus) return false;

    // 2. Schedule Filter (Day, Month, Year)
    if (scheduleFilterMode === "All") return true;

    const comps = getBookingDateComponents(b);
    if (!comps) return false;

    if (scheduleFilterMode === "Day") {
      return comps.day === schedDay;
    }
    if (scheduleFilterMode === "Month") {
      return comps.month === schedMonth;
    }
    if (scheduleFilterMode === "Year") {
      return comps.year === schedYear;
    }
    return true;
  });

  // Count stats
  const countPending = bookings.filter((b) => b.status === "Pending").length;
  const countActive = bookings.filter((b) => b.status === "Active").length;
  const countCompleted = bookings.filter((b) => b.status === "Completed").length;

  return (
    <div className="space-y-6" id="admin-view-root">
      {/* Header operations row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-3xl text-[#1A1A10]">Incoming Bookings Queue</h2>
          <p className="text-xs text-[#8A8A7A] mt-1 font-mono uppercase tracking-wider">
            test LAX Dispatch & Driver Assignment
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#5A5A40] flex items-center gap-1.5 mr-2">
            <Filter className="w-3.5 h-3.5" />
            Filter by:
          </span>
          {["All", "Pending", "Active", "Completed", "Cancelled"].map((status) => {
            const count = bookings.filter((b) => status === "All" ? true : b.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filterStatus === status
                    ? "bg-[#5A5A40] text-white shadow-sm"
                    : "bg-[#E6E6DF] text-[#5A5A40] hover:bg-[#D4D4C8]"
                }`}
              >
                {status === "All" && "All"}
                {status === "Pending" && "Pending"}
                {status === "Active" && "Active"}
                {status === "Completed" && "Completed"}
                {status === "Cancelled" && "Cancelled"}
                <span className="opacity-70 font-bold">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule filter panel */}
      <div className="bg-[#E6E6DF]/30 border border-[#E6E6DF] p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-[#5A5A40] flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-[#8A8A7A]" />
            Schedule View:
          </span>
          <div className="bg-[#E6E6DF]/60 p-0.5 rounded-lg inline-flex">
            {[
              { id: "All", label: "Show All" },
              { id: "Day", label: "By Day" },
              { id: "Month", label: "By Month" },
              { id: "Year", label: "By Year" }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setScheduleFilterMode(mode.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  scheduleFilterMode === mode.id
                    ? "bg-[#5A5A40] text-white shadow-sm"
                    : "text-[#5A5A40] hover:text-[#1A1A10]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Controls based on selected mode */}
        {scheduleFilterMode !== "All" && (
          <div className="flex flex-wrap items-center gap-2 animate-fadeIn w-full md:w-auto">
            {scheduleFilterMode === "Day" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="date"
                  value={schedDay}
                  onChange={(e) => setSchedDay(e.target.value)}
                  className="bg-white border border-[#C8C8BA] rounded-xl px-3 py-1.5 text-xs text-[#1A1A10] focus:outline-none focus:border-[#5A5A40] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSchedDay(new Date().toLocaleDateString("en-CA"))}
                  className="px-2.5 py-1.5 bg-[#E6E6DF] hover:bg-[#D4D4C8] text-[#5A5A40] text-[10px] font-bold uppercase rounded-lg transition-colors"
                >
                  Today
                </button>
              </div>
            )}

            {scheduleFilterMode === "Month" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="month"
                  value={schedMonth}
                  onChange={(e) => setSchedMonth(e.target.value)}
                  className="bg-white border border-[#C8C8BA] rounded-xl px-3 py-1.5 text-xs text-[#1A1A10] focus:outline-none focus:border-[#5A5A40] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSchedMonth(new Date().toLocaleDateString("en-CA").substring(0, 7))}
                  className="px-2.5 py-1.5 bg-[#E6E6DF] hover:bg-[#D4D4C8] text-[#5A5A40] text-[10px] font-bold uppercase rounded-lg transition-colors"
                >
                  This Month
                </button>
              </div>
            )}

            {scheduleFilterMode === "Year" && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={schedYear}
                  onChange={(e) => setSchedYear(Number(e.target.value))}
                  className="bg-white border border-[#C8C8BA] rounded-xl px-3 py-1.5 text-xs text-[#1A1A10] focus:outline-none focus:border-[#5A5A40] font-mono"
                >
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSchedYear(new Date().getFullYear())}
                  className="px-2.5 py-1.5 bg-[#E6E6DF] hover:bg-[#D4D4C8] text-[#5A5A40] text-[10px] font-bold uppercase rounded-lg transition-colors"
                >
                  This Year
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-800 rounded-xl flex items-center gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E6E6DF] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8A8A7A] tracking-wider">Pending Approval</span>
            <p className="text-3xl font-serif text-[#1A1A10] mt-1">{countPending}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FAF2E6] text-[#A67C41] flex items-center justify-center font-bold">
            P
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E6E6DF] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8A8A7A] tracking-wider">Active Rides</span>
            <p className="text-3xl font-serif text-[#1A1A10] mt-1">{countActive}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#EEF2E6] text-[#4A6741] flex items-center justify-center font-bold">
            A
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E6E6DF] rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8A8A7A] tracking-wider">Completed Rides</span>
            <p className="text-3xl font-serif text-[#1A1A10] mt-1">{countCompleted}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            C
          </div>
        </div>
      </div>

      {/* Bookings Table / List Card */}
      <div className="bg-white rounded-[32px] border border-[#E6E6DF] shadow-sm overflow-hidden flex flex-col">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-[#8A8A7A]">
            <p className="font-serif text-lg">No bookings found matching filters</p>
            <p className="text-xs mt-1">Try changing filters or adding a new booking request from the Customer tab.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FBFBF8] border-b border-[#E6E6DF] text-[11px] uppercase tracking-wider font-bold text-[#8A8A7A]">
                    <th className="px-6 py-4">Customer / Flight</th>
                    <th className="px-6 py-4">Terminal & Pillar</th>
                    <th className="px-6 py-4">Luggage & Drop-off</th>
                    <th className="px-6 py-4">Assigned Driver</th>
                    <th className="px-6 py-4 text-center">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F0]">
                  {filteredBookings.map((booking) => {
                    const assignedDriver = users.find((u) => u._id === booking.driver_id);
                    const aiResult = aiResults[booking._id];
                    const currentPillar = pillarInputs[booking._id] !== undefined ? pillarInputs[booking._id] : (booking.pickup_pillar || "");

                    return (
                      <tr key={booking._id} className="hover:bg-[#FDFDFB] transition-colors">
                        {/* Customer and flight detail */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-serif text-base text-[#1A1A10] font-semibold">{booking.customer_name}</span>
                            <span className="text-xs font-mono text-[#5A5A40] mt-0.5">{booking.customer_phone}</span>
                            {booking.customer_email && (
                              <span className="text-[11px] font-mono text-slate-500 mt-0.5">{booking.customer_email}</span>
                            )}
                            
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-xs bg-[#5A5A40]/10 text-[#5A5A40] font-bold px-2 py-0.5 rounded font-mono">
                                {booking.flight_number || "POINT-TO-POINT / HOURLY"}
                              </span>
                              
                              {/* Gemini AI Flight Check button */}
                              {booking.flight_number && booking.flight_number !== "N/A" && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckFlightAI(booking)}
                                  disabled={aiCheckingId === booking._id}
                                  className="text-[10px] flex items-center gap-1 bg-amber-500/10 text-amber-800 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-0.5 rounded font-semibold transition-colors"
                                  title="Check actual landing time via Gemini AI"
                                >
                                  <Sparkles className={`w-3 h-3 text-amber-600 ${aiCheckingId === booking._id ? "animate-spin" : ""}`} />
                                  {aiCheckingId === booking._id ? "AI Checking..." : "AI Check"}
                                </button>
                              )}
                            </div>

                            {/* AI Response Display */}
                            {aiResult && (
                              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-slate-800 space-y-1.5 max-w-sm">
                                <div className="flex items-center justify-between font-bold border-b border-amber-200/50 pb-1 text-[#5A5A40]">
                                  <span>🤖 Gemini AI Flight Check:</span>
                                  <span className={aiResult.valid ? "text-emerald-700" : "text-rose-700"}>
                                    {aiResult.valid ? "✓ Valid Flight" : "✕ Unrecognized"}
                                  </span>
                                </div>
                                <p><strong>Airline:</strong> {aiResult.airline}</p>
                                <p><strong>LAX Terminal:</strong> {aiResult.terminal}</p>
                                <p className="text-[11px] text-slate-600 italic">"{aiResult.notes}"</p>
                                {isBookingDateInPast(booking).inPast && (
                                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg font-semibold flex items-start gap-1.5 mt-2 shadow-sm">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[11px] font-bold">⚠️ Schedule is in the past ({isBookingDateInPast(booking).dateStr})!</p>
                                      <p className="text-[10px] text-rose-700 font-normal mt-0.5">Please call the customer to re-confirm flight details.</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Airport Terminal & Pickup Pillar */}
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-700 block max-w-[200px] truncate" title={booking.airport_terminal}>
                              {booking.airport_terminal}
                            </span>
                            
                            {/* Pillar dispatcher inline input */}
                            {booking.status === "Pending" ? (
                              <div className="flex flex-col gap-1 pt-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Pickup Pillar (Edit):</span>
                                <input
                                  type="text"
                                  value={currentPillar}
                                  onChange={(e) => setPillarInputs(prev => ({ ...prev, [booking._id]: e.target.value }))}
                                  placeholder="Pillar 4B"
                                  className="bg-[#FBFBF8] border border-[#D4D4C8] text-xs px-2 py-1 rounded focus:outline-none focus:border-[#5A5A40] w-28 font-semibold text-[#5A5A40]"
                                />
                              </div>
                            ) : (
                              <span className="inline-block bg-[#FAF2E6] text-[#A67C41] text-xs font-bold px-2 py-0.5 rounded border border-[#FAF2E6]">
                                {booking.pickup_pillar || "Pillar not set"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Luggage count & Dropoff Address */}
                        <td className="px-6 py-5">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                              <span>{booking.luggage_count} luggage bags</span>
                            </div>
                            {booking.selected_vehicle && (
                              <div className="text-[11px] text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block w-fit">
                                🚗 {booking.selected_vehicle}
                              </div>
                            )}
                            {booking.payment_method && (
                              <div className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block w-fit ml-1.5">
                                💳 {booking.payment_method}
                              </div>
                            )}
                            {booking.estimated_distance && (
                              <div className="text-[11px] text-[#4A6741] font-bold bg-[#EEF2E6] px-2 py-0.5 rounded border border-[#D4D4C8] inline-block w-fit ml-1.5 font-mono">
                                📏 {booking.estimated_distance} mi
                              </div>
                            )}
                            {booking.estimated_price && (
                              <div className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block w-fit ml-1.5 font-mono">
                                💵 ${booking.estimated_price}
                              </div>
                            )}
                            <div className="flex items-start gap-1 text-xs text-slate-700 font-medium mt-1">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <span>{renderAddressLinks(booking.dropoff_address)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Driver Assigned / Select driver dropdown */}
                        <td className="px-6 py-5">
                          {booking.status === "Pending" ? (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-[#8A8A7A] uppercase font-bold tracking-wider block">Assign Driver:</span>
                              <select
                                value={selectedDrivers[booking._id] || ""}
                                onChange={(e) => setSelectedDrivers(prev => ({ ...prev, [booking._id]: e.target.value }))}
                                className="bg-[#FBFBF8] border border-[#D4D4C8] text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#5A5A40] text-slate-700 font-medium w-40"
                              >
                                {drivers.map((drv) => (
                                  <option key={drv._id} value={drv._id}>
                                    {drv.name} ({drv.phone})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="text-xs">
                              {assignedDriver ? (
                                <div className="p-2 bg-[#EEF2E6] border border-[#D4D4C8]/50 rounded-lg">
                                  <p className="font-bold text-slate-800">{assignedDriver.name}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{assignedDriver.phone}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Unassigned</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status badge and actions */}
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-2">
                            {/* Status Badge */}
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase inline-block ${
                              booking.status === "Pending" ? "bg-[#FAF2E6] text-[#A67C41]" :
                              booking.status === "Active" ? "bg-[#EEF2E6] text-[#4A6741]" :
                              booking.status === "Completed" ? "bg-slate-100 text-slate-600" :
                              "bg-rose-100 text-rose-600"
                            }`}>
                              {booking.status === "Pending" && "Pending"}
                              {booking.status === "Active" && "Active"}
                              {booking.status === "Completed" && "Completed"}
                              {booking.status === "Cancelled" && "Cancelled"}
                            </span>

                            {/* Quick dispatch / status buttons */}
                            <div className="flex items-center gap-1 mt-1">
                              {booking.status === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleDispatch(booking)}
                                  disabled={isUpdatingId === booking._id}
                                  className="bg-[#5A5A40] hover:bg-[#4a4a34] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  title="Approve and assign driver"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                              )}

                              {booking.status === "Active" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusUpdate(booking._id, "Completed")}
                                    disabled={isUpdatingId === booking._id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                                    title="Mark as completed"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusUpdate(booking._id, "Cancelled")}
                                    disabled={isUpdatingId === booking._id}
                                    className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                                    title="Cancel ride"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {/* Delete or Reset to Pending for testing */}
                              {(booking.status === "Completed" || booking.status === "Cancelled") && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(booking._id, "Pending")}
                                  disabled={isUpdatingId === booking._id}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold px-2 py-1 rounded"
                                  title="Reset back to pending for testing"
                                >
                                  Reset Pending
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleStartEdit(booking)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors"
                                title="Edit customer / booking information"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this booking from queue?")) {
                                    onDeleteBooking(booking._id);
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Delete booking"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile friendly card view */}
            <div className="block md:hidden divide-y divide-[#F5F5F0]">
              {filteredBookings.map((booking) => {
                const assignedDriver = users.find((u) => u._id === booking.driver_id);
                const aiResult = aiResults[booking._id];
                const currentPillar = pillarInputs[booking._id] !== undefined ? pillarInputs[booking._id] : (booking.pickup_pillar || "");

                return (
                  <div key={booking._id} className="p-4 space-y-3 hover:bg-[#FDFDFB] transition-colors">
                    {/* Row 1: Status & Actions */}
                    <div className="flex justify-between items-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase inline-block ${
                        booking.status === "Pending" ? "bg-[#FAF2E6] text-[#A67C41]" :
                        booking.status === "Active" ? "bg-[#EEF2E6] text-[#4A6741]" :
                        booking.status === "Completed" ? "bg-slate-100 text-slate-600" :
                        "bg-rose-100 text-rose-600"
                      }`}>
                        {booking.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(booking)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors"
                          title="Edit booking"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this booking from queue?")) {
                              onDeleteBooking(booking._id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Delete booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Customer details */}
                    <div>
                      <h4 className="font-serif text-base text-[#1A1A10] font-semibold">{booking.customer_name}</h4>
                      <p className="text-xs font-mono text-[#5A5A40] mt-0.5">{booking.customer_phone}</p>
                      {booking.customer_email && (
                        <p className="text-[11px] font-mono text-slate-500">{booking.customer_email}</p>
                      )}
                    </div>

                    {/* Row 3: Flight details */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] font-bold px-2 py-0.5 rounded font-mono">
                        {booking.flight_number || "POINT-TO-POINT / HOURLY"}
                      </span>
                      {booking.flight_number && booking.flight_number !== "N/A" && (
                        <button
                          type="button"
                          onClick={() => handleCheckFlightAI(booking)}
                          disabled={aiCheckingId === booking._id}
                          className="text-[10px] flex items-center gap-1 bg-amber-500/10 text-amber-800 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-0.5 rounded font-semibold transition-colors"
                        >
                          <Sparkles className={`w-3 h-3 text-amber-600 ${aiCheckingId === booking._id ? "animate-spin" : ""}`} />
                          {aiCheckingId === booking._id ? "AI Checking..." : "AI Check"}
                        </button>
                      )}
                    </div>

                    {/* AI Check notes */}
                    {aiResult && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-slate-800 space-y-1 mt-1">
                        <p className="font-bold text-[#5A5A40] flex justify-between">
                          <span>🤖 Flight Status:</span>
                          <span className={aiResult.valid ? "text-emerald-700" : "text-rose-700"}>
                            {aiResult.valid ? "Valid Flight" : "Unrecognized"}
                          </span>
                        </p>
                        <p><strong>Airline:</strong> {aiResult.airline} | <strong>Terminal:</strong> {aiResult.terminal}</p>
                        <p className="text-[11px] text-slate-600 italic">"{aiResult.notes}"</p>
                        {isBookingDateInPast(booking).inPast && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2 rounded-lg font-semibold text-[10px] mt-1.5">
                            ⚠️ Past Schedule! Call customer to reconfirm.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 4: Pickup Terminal & Pillar info */}
                    <div className="bg-[#FAFBF7] border border-[#E6E6DF] p-3 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Terminal:</span>
                        <span className="font-semibold text-slate-700 truncate max-w-[180px]">{booking.airport_terminal}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Pillar:</span>
                        {booking.status === "Pending" ? (
                          <input
                            type="text"
                            value={currentPillar}
                            onChange={(e) => setPillarInputs(prev => ({ ...prev, [booking._id]: e.target.value }))}
                            placeholder="Pillar 4B"
                            className="bg-white border border-[#D4D4C8] text-xs px-2 py-0.5 rounded focus:outline-none focus:border-[#5A5A40] w-24 text-right font-semibold text-[#5A5A40]"
                          />
                        ) : (
                          <span className="bg-[#FAF2E6] text-[#A67C41] text-[11px] font-bold px-1.5 py-0.5 rounded">
                            {booking.pickup_pillar || "Not set"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 5: Ride details & Drop-off */}
                    <div className="text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                          💼 {booking.luggage_count} bags
                        </span>
                        {booking.selected_vehicle && (
                          <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-100">
                            🚗 {booking.selected_vehicle}
                          </span>
                        )}
                        {booking.payment_method && (
                          <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px] border border-emerald-100">
                            💳 {booking.payment_method}
                          </span>
                        )}
                        {booking.estimated_distance && (
                          <span className="bg-[#EEF2E6] text-[#4A6741] font-semibold px-2 py-0.5 rounded text-[10px] border border-[#D4D4C8] font-mono">
                            📏 {booking.estimated_distance} mi
                          </span>
                        )}
                        {booking.estimated_price && (
                          <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded text-[10px] border border-amber-200 font-mono">
                            💵 ${booking.estimated_price}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-1 mt-1 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="leading-tight">{renderAddressLinks(booking.dropoff_address)}</span>
                      </div>
                    </div>

                    {/* Row 6: Driver assignment & Action button */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F0] gap-2">
                      {booking.status === "Pending" ? (
                        <div className="flex items-center gap-1.5 w-full justify-between">
                          <select
                            value={selectedDrivers[booking._id] || ""}
                            onChange={(e) => setSelectedDrivers(prev => ({ ...prev, [booking._id]: e.target.value }))}
                            className="bg-white border border-[#D4D4C8] text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#5A5A40] text-slate-700 font-medium flex-1 max-w-[150px]"
                          >
                            {drivers.map((drv) => (
                              <option key={drv._id} value={drv._id}>
                                {drv.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDispatch(booking)}
                            disabled={isUpdatingId === booking._id}
                            className="bg-[#5A5A40] hover:bg-[#4a4a34] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div>
                            {assignedDriver ? (
                              <span className="text-[11px] font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                👤 {assignedDriver.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No driver</span>
                            )}
                          </div>

                          <div className="flex gap-1">
                            {booking.status === "Active" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(booking._id, "Completed")}
                                  disabled={isUpdatingId === booking._id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(booking._id, "Cancelled")}
                                  disabled={isUpdatingId === booking._id}
                                  className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {(booking.status === "Completed" || booking.status === "Cancelled") && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(booking._id, "Pending")}
                                disabled={isUpdatingId === booking._id}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold px-2 py-1.5 rounded"
                              >
                                Reset Pending
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* User Management Panel */}
      <div className="bg-white rounded-[32px] border border-[#E6E6DF] shadow-sm p-6 space-y-6" id="user-management-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#F5F5F0] pb-4">
          <div>
            <h3 className="font-serif text-2xl text-[#1A1A10] flex items-center gap-2">
              <User className="w-6 h-6 text-[#5A5A40]" />
              Staff & Drivers Directory
            </h3>
            <p className="text-xs text-[#8A8A7A] mt-1">
              Manage administrators (Admin) and drivers (Driver) registered in test.
            </p>
          </div>

          <button
            onClick={() => {
              setShowAddUserForm(!showAddUserForm);
              setUserSuccessMessage("");
            }}
            className="px-4 py-2 bg-[#5A5A40] text-white text-xs font-bold rounded-xl hover:bg-opacity-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {showAddUserForm ? "Close Form" : "+ Add New Staff"}
          </button>
        </div>

        {/* Add User Form */}
        {showAddUserForm && (
          <form onSubmit={handleCreateUserSubmit} className="bg-[#FAFBF7] border border-[#E6E6DF] rounded-2xl p-5 space-y-4 max-w-2xl" id="add-user-form">
            <h4 className="text-sm font-bold text-[#5A5A40] uppercase tracking-wider">Register New Staff Account</h4>
            
            {userSuccessMessage && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold">
                {userSuccessMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Michael Tran"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="michael.tran@trishuttle.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. +1 714-555-1234"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">System Role *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as "Admin" | "Driver")}
                  className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#5A5A40]"
                >
                  <option value="Driver">Driver (LAX Pickup/Dropoff)</option>
                  <option value="Admin">Admin (System Dispatcher)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Password (Default: 123456)</label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddUserForm(false);
                  setUserSuccessMessage("");
                }}
                className="px-4 py-2 border border-[#D4D4C8] text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="px-5 py-2 bg-[#5A5A40] text-white text-xs font-bold rounded-xl hover:bg-opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isCreatingUser ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Submit Registration"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Existing Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="users-display-grid">
          {users.map((u) => {
            const isDriver = u.role === "Driver";
            return (
              <div 
                key={u._id} 
                className={`p-4 rounded-2xl border transition-all ${
                  isDriver 
                    ? "bg-[#FAFBF7] border-[#E6E6DF] hover:border-[#5A5A40]/30" 
                    : "bg-[#5A5A40]/5 border-[#5A5A40]/20 hover:border-[#5A5A40]/40"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isDriver 
                        ? "bg-[#EEF2E6] text-[#4A6741]" 
                        : "bg-[#FAF2E6] text-[#A67C41]"
                    }`}>
                      {u.role === "Admin" ? "Administrator" : "Driver"}
                    </span>
                    <h4 className="font-serif text-base text-[#1A1A10] font-bold mt-2">{u.name}</h4>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#E0E0D5] flex items-center justify-center font-bold text-xs text-[#5A5A40]">
                    {u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F5F5F0] space-y-1 text-xs text-slate-600 font-medium">
                  <p className="truncate"><span className="text-[#8A8A7A]">Email:</span> {u.email}</p>
                  <p><span className="text-[#8A8A7A]">Phone:</span> {u.phone}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* EDIT BOOKING MODAL */}
        {editingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#FAFBF9] border border-[#E6E6DF] rounded-[32px] w-full max-w-2xl shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto text-left">
              
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-[#E6E6DF]">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#1A1A10]">Edit Booking Details</h3>
                  <p className="text-xs text-slate-500 mt-1">Modify reservation details for: <span className="font-semibold text-slate-800">{editingBooking.customer_name}</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-6">
                
                {/* SECTION 1: Customer Contact */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider border-l-2 border-[#5A5A40] pl-2">Customer & Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                        required
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Phone</label>
                      <input
                        type="text"
                        value={editForm.customer_phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                        required
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Email</label>
                      <input
                        type="email"
                        value={editForm.customer_email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, customer_email: e.target.value }))}
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Ride Route & Destination */}
                <div className="space-y-3 pt-2 border-t border-[#F5F5F0]">
                  <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider border-l-2 border-[#5A5A40] pl-2">Route & Locations</h4>
                  
                  {/* Airport Toggle */}
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="edit_is_airport_pickup"
                      checked={editForm.is_airport_pickup}
                      onChange={(e) => setEditForm(prev => ({ ...prev, is_airport_pickup: e.target.checked, pickup_address: e.target.checked ? "LAX Airport" : "" }))}
                      className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <label htmlFor="edit_is_airport_pickup" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Pickup is from Airport? (Requires Flight details)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pickup Location */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pickup From Address</label>
                      <input
                        type="text"
                        value={editForm.pickup_address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pickup_address: e.target.value }))}
                        disabled={editForm.is_airport_pickup}
                        required
                        placeholder={editForm.is_airport_pickup ? "LAX Airport (Set automatically)" : "e.g. 123 Main St, Irvine, CA"}
                        className="w-full bg-white border border-[#D4D4C8] disabled:bg-slate-50 disabled:text-slate-500 rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>

                    {/* Dropoff Location */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dropoff To Address</label>
                      <input
                        type="text"
                        value={editForm.dropoff_address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dropoff_address: e.target.value }))}
                        required
                        placeholder="e.g. Disneyland Resort, Anaheim, CA"
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>

                  {/* Airport specific fields */}
                  {editForm.is_airport_pickup && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50/50 border border-amber-200/50 p-4 rounded-2xl animate-fadeIn">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Flight Number</label>
                        <input
                          type="text"
                          value={editForm.flight_number}
                          onChange={(e) => setEditForm(prev => ({ ...prev, flight_number: e.target.value }))}
                          required={editForm.is_airport_pickup}
                          placeholder="e.g. VN521"
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Airport Terminal</label>
                        <input
                          type="text"
                          value={editForm.airport_terminal}
                          onChange={(e) => setEditForm(prev => ({ ...prev, airport_terminal: e.target.value }))}
                          placeholder="e.g. Tom Bradley International Terminal"
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Pickup Pillar</label>
                        <input
                          type="text"
                          value={editForm.airport_pillar}
                          onChange={(e) => setEditForm(prev => ({ ...prev, airport_pillar: e.target.value }))}
                          placeholder="e.g. Pillar 4B"
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 3: Booking Schedule */}
                <div className="space-y-3 pt-2 border-t border-[#F5F5F0]">
                  <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider border-l-2 border-[#5A5A40] pl-2">Schedule & Passengers</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pickup Date</label>
                      <input
                        type="date"
                        value={editForm.pickup_date}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pickup_date: e.target.value }))}
                        required
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pickup Time</label>
                      <input
                        type="text"
                        value={editForm.pickup_time}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pickup_time: e.target.value }))}
                        required
                        placeholder="e.g. 8:00 AM"
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Passengers Count</label>
                      <input
                        type="number"
                        value={editForm.passengers}
                        onChange={(e) => setEditForm(prev => ({ ...prev, passengers: Number(e.target.value) }))}
                        min="1"
                        required
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Child Seats Count</label>
                      <input
                        type="number"
                        value={editForm.child_seats}
                        onChange={(e) => setEditForm(prev => ({ ...prev, child_seats: Number(e.target.value) }))}
                        min="0"
                        required
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Ride Settings, Pricing & Status */}
                <div className="space-y-3 pt-2 border-t border-[#F5F5F0]">
                  <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider border-l-2 border-[#5A5A40] pl-2">Ride Settings & Pricing</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vehicle Selection</label>
                      <select
                        value={editForm.selected_vehicle}
                        onChange={(e) => setEditForm(prev => ({ ...prev, selected_vehicle: e.target.value }))}
                        className="w-full bg-white border border-[#D4D4C8] text-slate-700 font-medium rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#5A5A40]"
                      >
                        <option value="">Select Vehicle</option>
                        <option value="Standard Luxury Sedan">Standard Luxury Sedan ($30/mi)</option>
                        <option value="Premium Luxury SUV">Premium Luxury SUV ($40/mi)</option>
                        <option value="Premium Passenger Van">Premium Passenger Van ($50/mi)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method</label>
                      <select
                        value={editForm.payment_method}
                        onChange={(e) => setEditForm(prev => ({ ...prev, payment_method: e.target.value }))}
                        className="w-full bg-white border border-[#D4D4C8] text-slate-700 font-medium rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#5A5A40]"
                      >
                        <option value="">Select Method</option>
                        <option value="Cash to Driver">Cash to Driver</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Credit Card (Paid via Stripe)">Credit Card (Paid via Stripe)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ride Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as IBooking["status"] }))}
                        className="w-full bg-white border border-[#D4D4C8] text-slate-700 font-medium rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#5A5A40]"
                      >
                        <option value="Pending">Pending Approval</option>
                        <option value="Active">Active Ride</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Luggage Bags</label>
                      <input
                        type="number"
                        value={editForm.luggage_count}
                        onChange={(e) => setEditForm(prev => ({ ...prev, luggage_count: Number(e.target.value) }))}
                        min="0"
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Distance (miles)</label>
                      <input
                        type="number"
                        step="any"
                        value={editForm.estimated_distance}
                        onChange={(e) => setEditForm(prev => ({ ...prev, estimated_distance: e.target.value }))}
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Calculated Price ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={editForm.estimated_price}
                        onChange={(e) => setEditForm(prev => ({ ...prev, estimated_price: e.target.value }))}
                        className="w-full bg-white border border-[#D4D4C8] rounded-xl px-3 py-2 text-sm text-[#1A1A10] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[#E6E6DF]">
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="px-5 py-2.5 border border-[#D4D4C8] text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#5A5A40] text-white text-xs font-bold rounded-xl hover:bg-opacity-95 transition-all cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
