import React, { useState, useEffect } from "react";
import CustomerView from "./components/CustomerView";
import AdminView from "./components/AdminView";
import DriverView from "./components/DriverView";
import LoginView from "./components/LoginView";
import { IBooking, IUser } from "./types";
import { Users, Shield, Plane, RefreshCw, LogOut, Lock, Layers } from "lucide-react";

export default function App() {
  // Simple state router
  const [path, setPath] = useState(window.location.pathname);
  
  // Authenticated user session
  const [authenticatedUser, setAuthenticatedUser] = useState<IUser | null>(() => {
    try {
      const stored = localStorage.getItem("tri_shuttle_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Fetch initial data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bookingsRes, usersRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/users"),
      ]);

      if (!bookingsRes.ok || !usersRes.ok) {
        throw new Error("Error loading data from server.");
      }

      const bookingsData = await bookingsRes.json();
      const usersData = await usersRes.json();

      setBookings(bookingsData);
      setUsers(usersData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Cannot connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Update booking handler
  const handleUpdateBooking = async (id: string, updates: Partial<IBooking>) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update booking.");
      }

      const updatedBooking = await res.json();
      setBookings((prev) => prev.map((b) => (b._id === id ? updatedBooking : b)));
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
      throw err;
    }
  };

  // Delete booking handler
  const handleDeleteBooking = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete booking.");
      }

      setBookings((prev) => prev.filter((b) => b._id !== id));
    } catch (err: any) {
      console.error(err);
      alert("Error deleting booking: " + err.message);
      throw err;
    }
  };

  const handleBookingCreated = (newBooking: IBooking) => {
    setBookings((prev) => [newBooking, ...prev]);
  };

  const handleCreateUser = async (user: Omit<IUser, "_id">) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to create account.");
    }
    const newUser = await res.json();
    setUsers((prev) => [...prev, newUser]);
  };

  const handleLoginSuccess = (user: IUser) => {
    setAuthenticatedUser(user);
    localStorage.setItem("tri_shuttle_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuthenticatedUser(null);
    localStorage.removeItem("tri_shuttle_user");
  };

  // Helper to handle client-side SPA routing click
  const navigateTo = (newPath: string) => {
    window.history.pushState({}, "", newPath);
    setPath(newPath);
  };

  const isAdminRoute = path.startsWith("/admin");

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#2D2D2A] font-sans flex flex-col justify-between" id="app-wrapper">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-[#E6E6DF] shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigateTo("/")}>
            <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center shadow-inner">
              <span className="text-white font-serif italic text-xl">T</span>
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl tracking-tight text-[#1A1A10] font-bold">
                Tri Shuttle LAX
              </h1>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#8A8A7A] font-extrabold">
                {isAdminRoute ? "Operation Management Console" : "LAX Private Luxury Transport"}
              </p>
            </div>
          </div>

          {/* User Status / Navigation Actions */}
          <div className="flex items-center gap-4 sm:gap-6">
            {isAdminRoute ? (
              authenticatedUser ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-800">{authenticatedUser.name}</p>
                    <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider">
                      {authenticatedUser.role === "Admin" ? "Administrator" : "Driver"}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 sm:px-3 sm:py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure Operations Portal</span>
                </div>
              )
            ) : (
              <button
                onClick={() => navigateTo("/admin")}
                className="px-4 py-2 border border-[#5A5A40] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin Portal
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ADMIN CONTROL BAR (Only visible to logged-in users on /admin route) */}
      {isAdminRoute && authenticatedUser && (
        <div className="bg-[#E6E6DF] border-b border-[#D4D4C8] py-3.5 px-4 sticky top-20 z-30 shadow-sm animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5A5A40]" />
              <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">
                Active System:
              </span>
              <span className="bg-[#5A5A40] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                Role: {authenticatedUser.role}
              </span>
            </div>

            <div className="text-xs font-bold text-[#5A5A40]">
              {authenticatedUser.role === "Admin" ? (
                <span className="flex items-center gap-1.5">
                  Pending Approval: 
                  <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    {bookings.filter((b) => b.status === "Pending").length} rides
                  </span>
                </span>
              ) : (
                <span>Personal Driver Schedule</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN OPERATIONAL STAGE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8" id="main-content-area">
        {loading && bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-[#5A5A40] animate-spin" />
            <p className="font-serif text-lg text-slate-600">Synchronizing Tri Shuttle LAX data...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-100 border border-rose-300 text-rose-800 rounded-2xl p-6 text-center max-w-lg mx-auto space-y-4">
            <h3 className="font-serif text-lg font-bold">Server Connection Error</h3>
            <p className="text-sm">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-2.5 bg-[#5A5A40] text-white text-xs font-bold rounded-xl hover:bg-opacity-95"
            >
              Reconnect
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. ADMIN ROUTE */}
            {isAdminRoute ? (
              !authenticatedUser ? (
                <LoginView onLoginSuccess={handleLoginSuccess} />
              ) : authenticatedUser.role === "Admin" ? (
                <AdminView
                  bookings={bookings}
                  users={users}
                  onUpdateBooking={handleUpdateBooking}
                  onDeleteBooking={handleDeleteBooking}
                  onCreateUser={handleCreateUser}
                  onRefresh={loadData}
                />
              ) : (
                <DriverView
                  bookings={bookings}
                  users={users}
                  onUpdateBooking={handleUpdateBooking}
                  onRefresh={loadData}
                  loggedInUser={authenticatedUser}
                />
              )
            ) : (
              /* 2. PUBLIC CUSTOMER ROUTE */
              <>
                <div className="bg-[#FAFBF7] border border-[#E6E6DF] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-2 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
                    <span className="text-xs font-semibold text-slate-600">
                      LAX online dispatch system is active. Fleet is ready to serve you.
                    </span>
                  </div>
                  <button 
                    onClick={loadData}
                    className="text-xs font-bold text-[#5A5A40] hover:underline underline-offset-4 flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh Bookings
                  </button>
                </div>

                <CustomerView
                  onBookingCreated={handleBookingCreated}
                  recentBookings={bookings}
                  onRefreshBookings={loadData}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* FOOTER SECTION */}
      <footer className="bg-white border-t border-[#E6E6DF] shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4 sm:gap-6 text-[9px] sm:text-[10px] uppercase tracking-widest text-[#8A8A7A] font-bold justify-center sm:justify-start">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Server Sync: Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              LAX Fleet: Ready
            </span>
            <span className="flex items-center gap-1 flex-wrap">
              App Mode: 
              <span className="text-[#5A5A40] ml-1 font-semibold normal-case">
                {isAdminRoute ? "Internal Portal" : "Customer Website"}
              </span>
            </span>
          </div>
          <span className="text-[10px] text-[#5A5A40] font-medium italic underline underline-offset-4 text-center cursor-pointer" onClick={() => navigateTo(isAdminRoute ? "/" : "/admin")}>
            {isAdminRoute ? "Go to Customer Booking Page" : "Admin Portal Login"}
          </span>
        </div>
      </footer>
    </div>
  );
}
