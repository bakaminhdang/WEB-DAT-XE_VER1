import React, { useState, useEffect } from "react";
import { IBooking, IUser } from "../types";
import { Phone, CheckCircle, Briefcase, MapPin, Plane, Shield, MessageSquare, AlertCircle, Calendar } from "lucide-react";

interface DriverViewProps {
  bookings: IBooking[];
  users: IUser[];
  onUpdateBooking: (id: string, updates: Partial<IBooking>) => Promise<void>;
  onRefresh: () => void;
  loggedInUser?: IUser;
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

export default function DriverView({ bookings, users, onUpdateBooking, onRefresh, loggedInUser }: DriverViewProps) {
  const drivers = users.filter((u) => u.role === "Driver");
  
  // Default to John Miller, but lock to loggedInUser if provided
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    loggedInUser ? loggedInUser._id : "driver_john_miller"
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Schedule filtering states
  const [scheduleFilterMode, setScheduleFilterMode] = useState<"All" | "Day" | "Month" | "Year">("All");
  const [schedDay, setSchedDay] = useState<string>(new Date().toLocaleDateString("en-CA")); // "YYYY-MM-DD"
  const [schedMonth, setSchedMonth] = useState<string>(new Date().toLocaleDateString("en-CA").substring(0, 7)); // "YYYY-MM"
  const [schedYear, setSchedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (loggedInUser) {
      setSelectedDriverId(loggedInUser._id);
    }
  }, [loggedInUser]);

  const activeDriver = drivers.find((d) => d._id === selectedDriverId) || loggedInUser || drivers[0];

  const matchesScheduleFilter = (booking: IBooking) => {
    if (scheduleFilterMode === "All") return true;
    const comps = getBookingDateComponents(booking);
    if (!comps) return false;
    if (scheduleFilterMode === "Day") return comps.day === schedDay;
    if (scheduleFilterMode === "Month") return comps.month === schedMonth;
    if (scheduleFilterMode === "Year") return comps.year === schedYear;
    return true;
  };

  // Filter bookings for this driver that are "Active"
  const assignedActiveBookings = bookings.filter(
    (b) => b.driver_id === selectedDriverId && b.status === "Active" && matchesScheduleFilter(b)
  );

  // Filter historical bookings for this driver (Completed/Cancelled)
  const assignedHistoryBookings = bookings.filter(
    (b) => b.driver_id === selectedDriverId && (b.status === "Completed" || b.status === "Cancelled") && matchesScheduleFilter(b)
  );

  const handleMarkCompleted = async (id: string) => {
    setUpdatingId(id);
    try {
      await onUpdateBooking(id, { status: "Completed" });
    } catch (err) {
      alert("Error updating completion status: " + err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper to format phone for WhatsApp link
  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, "");
    return `https://wa.me/${cleanPhone}`;
  };



  return (
    <div className="space-y-6" id="driver-view-root">
      {/* Driver Identity Block */}
      <div className="bg-white border border-[#E6E6DF] rounded-[24px] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-serif text-lg text-[#1A1A10] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#5A5A40]" />
              {loggedInUser ? "Driver Details" : "Simulate Driver Login"}
            </h3>
            <p className="text-xs text-[#8A8A7A] mt-1">
              {loggedInUser 
                ? "Active driver account details." 
                : "Simulate driver login to check assignments at LAX Terminals."}
            </p>
          </div>

          {!loggedInUser && (
            <div className="flex gap-2 w-full sm:w-auto">
              {drivers.map((drv) => (
                <button
                  key={drv._id}
                  onClick={() => setSelectedDriverId(drv._id)}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all border ${
                    selectedDriverId === drv._id
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm"
                      : "bg-white text-[#5A5A40] border-[#E6E6DF] hover:bg-[#F5F5F0]"
                  }`}
                >
                  {drv.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeDriver && (
          <div className="mt-4 pt-4 border-t border-[#F5F5F0] flex flex-wrap gap-4 text-xs text-slate-600">
            <div>
              <span className="font-bold text-slate-400 mr-1">Driver Name:</span>
              <span className="font-semibold text-slate-800">{activeDriver.name}</span>
            </div>
            <div>
              <span className="font-bold text-slate-400 mr-1">Phone Number:</span>
              <span className="font-mono text-slate-800">{activeDriver.phone}</span>
            </div>
            <div>
              <span className="font-bold text-slate-400 mr-1">Operating Zone:</span>
              <span className="text-[#5A5A40] font-semibold">LAX ⇆ Orange County, Little Saigon, Irvine</span>
            </div>
          </div>
        )}
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

      {/* Main Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Rides list (Mobile friendly look) */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="font-serif text-2xl text-[#1A1A10] flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Active Rides ({assignedActiveBookings.length})
          </h2>

          {assignedActiveBookings.length === 0 ? (
            <div className="bg-white border border-[#E6E6DF] rounded-[32px] p-8 text-center text-[#8A8A7A]">
              <AlertCircle className="w-8 h-8 text-[#5A5A40] mx-auto mb-2" />
              <p className="font-serif text-lg text-slate-800">No active rides assigned</p>
              <p className="text-xs mt-1">Please use an Admin account to approve and assign pending bookings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedActiveBookings.map((booking) => (
                <div 
                  key={booking._id} 
                  className="bg-white border-2 border-[#5A5A40]/30 hover:border-[#5A5A40]/60 rounded-[28px] p-5 shadow-sm transition-all space-y-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 bg-[#EEF2E6] text-[#4A6741] text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider">
                    Assigned
                  </div>

                  {/* Customer Block */}
                  <div className="flex justify-between items-start pt-2">
                    <div>
                      <span className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider block">Passenger to pick up</span>
                      <h3 className="font-serif text-xl text-[#1A1A10] font-bold mt-0.5">{booking.customer_name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">{booking.customer_phone}</p>
                      {booking.customer_email && (
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{booking.customer_email}</p>
                      )}
                    </div>

                    {/* Fast Communication buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={getWhatsAppLink(booking.customer_phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${booking.customer_phone}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call Phone
                      </a>
                    </div>
                  </div>

                  {/* Routing / airport information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FBFBF8] p-4 rounded-2xl border border-[#E6E6DF]">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                        <Plane className="w-4 h-4 text-[#5A5A40]" />
                        <span>AIRPORT / FLIGHT</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {booking.airport_terminal}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-[#5A5A40] text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                          {booking.flight_number}
                        </span>
                        {booking.pickup_pillar && (
                          <span className="bg-amber-100 text-amber-800 font-bold text-xs px-2 py-0.5 rounded border border-amber-200">
                            PILLAR: {booking.pickup_pillar}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        <span>DROP-OFF ADDRESS (DESTINATION)</span>
                      </div>
                      <p className="text-sm font-bold text-[#1A1A10]">
                        {renderAddressLinks(booking.dropoff_address)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          Luggage count: {booking.luggage_count} bags
                        </span>
                        {booking.selected_vehicle && (
                          <span className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                            🚗 {booking.selected_vehicle}
                          </span>
                        )}
                        {booking.payment_method && (
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                            💳 {booking.payment_method}
                          </span>
                        )}
                        {booking.estimated_distance && (
                          <span className="font-bold text-[#4A6741] bg-[#EEF2E6] border border-[#D4D4C8] px-2 py-0.5 rounded font-mono">
                            📏 {booking.estimated_distance} mi
                          </span>
                        )}
                        {booking.estimated_price && (
                          <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono">
                            💵 ${booking.estimated_price}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-[11px] text-[#8A8A7A] italic">
                      Created: {new Date(booking.createdAt).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => handleMarkCompleted(booking._id)}
                      disabled={updatingId === booking._id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirm Ride Completed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Driver stats and history */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#5A5A40] text-white p-6 rounded-[28px] shadow-md space-y-4">
            <h3 className="font-serif text-lg font-bold border-b border-white/20 pb-2">Driver Performance</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/10 rounded-xl">
                <span className="text-[10px] uppercase font-bold opacity-75">Active</span>
                <p className="text-2xl font-serif mt-1">{assignedActiveBookings.length}</p>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <span className="text-[10px] uppercase font-bold opacity-75">Completed</span>
                <p className="text-2xl font-serif mt-1">
                  {assignedHistoryBookings.filter((b) => b.status === "Completed").length}
                </p>
              </div>
            </div>

            <div className="text-xs text-white/80 space-y-2 pt-1 leading-relaxed">
              <p className="font-semibold text-amber-300">💡 LAX Pickup Guidelines:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Do not park for more than 5 minutes at the Arrivals outer curb.</li>
                <li>Contact customer via Phone/WhatsApp upon landing to locate their Pillar.</li>
                <li>Help customers handle their luggage with care.</li>
              </ul>
            </div>
          </div>

          {/* History of trips */}
          <div className="bg-white border border-[#E6E6DF] rounded-[24px] p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider">Recent Ride History</h3>
            
            {assignedHistoryBookings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No completed trips in this session yet.</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto divide-y divide-slate-100 pr-1">
                {assignedHistoryBookings.map((b) => (
                  <div key={b._id} className="pt-2 first:pt-0 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-800">{b.customer_name}</span>
                      <span className={`text-[10px] font-bold ${b.status === "Completed" ? "text-emerald-600" : "text-rose-600"}`}>
                        {b.status === "Completed" ? "COMPLETED" : "CANCELLED"}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono text-[10px] mt-0.5">{b.flight_number} • {b.airport_terminal}</p>
                    <p className="text-slate-600 mt-1">{renderAddressLinks(b.dropoff_address)}</p>
                    {(b.estimated_distance || b.estimated_price) && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {b.estimated_distance && `📏 ${b.estimated_distance} mi`}
                        {b.estimated_distance && b.estimated_price && " • "}
                        {b.estimated_price && `💵 $${b.estimated_price}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
