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
  Trash2
} from "lucide-react";

interface AdminViewProps {
  bookings: IBooking[];
  users: IUser[];
  onUpdateBooking: (id: string, updates: Partial<IBooking>) => Promise<void>;
  onDeleteBooking: (id: string) => Promise<void>;
  onCreateUser: (user: Omit<IUser, "_id">) => Promise<void>;
  onRefresh: () => void;
}

export default function AdminView({ bookings, users, onUpdateBooking, onDeleteBooking, onCreateUser, onRefresh }: AdminViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [aiCheckingId, setAiCheckingId] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, { valid: boolean; airline: string; terminal: string; notes: string }>>({});
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [pillarInputs, setPillarInputs] = useState<Record<string, string>>({});
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (filterStatus === "All") return true;
    return b.status === filterStatus;
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
          <div className="overflow-x-auto">
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
                          <div className="flex items-start gap-1 text-xs text-slate-700 font-medium mt-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{booking.dropoff_address}</span>
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
                                  onClick={() => handleStatusUpdate(booking._id, "Completed")}
                                  disabled={isUpdatingId === booking._id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                                  title="Mark as completed"
                                >
                                  Complete
                                </button>
                                <button
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
                                onClick={() => handleStatusUpdate(booking._id, "Pending")}
                                disabled={isUpdatingId === booking._id}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold px-2 py-1 rounded"
                                title="Reset back to pending for testing"
                              >
                                Reset Pending
                              </button>
                            )}

                            <button
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
      </div>
    </div>
  );
}
