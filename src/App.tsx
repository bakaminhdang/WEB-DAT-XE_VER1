import React, { useState, useEffect } from "react";
import CustomerView from "./components/CustomerView";
import AdminView from "./components/AdminView";
import DriverView from "./components/DriverView";
import LoginView from "./components/LoginView";
import { IBooking, IUser } from "./types";
import { 
  Users, Shield, Plane, RefreshCw, LogOut, Lock, Layers,
  ChevronDown, ChevronUp, Clock, MapPin, Phone, Mail, Check, Award
} from "lucide-react";
import { 
  getBookings, 
  getUsers, 
  updateBooking, 
  deleteBooking, 
  createUser 
} from "./utils/db";

export default function App() {
  // Simple state router using hash
  const [path, setPath] = useState(() => {
    const hash = window.location.hash;
    if (!hash) {
      if (window.location.pathname.endsWith("/admin") || window.location.pathname.endsWith("/admin/")) {
        return "#/admin";
      }
      return "#/";
    }
    return hash;
  });
  
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
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    if (path.startsWith("#/admin") || path.startsWith("/admin")) {
      window.location.hash = "#/";
      setPath("#/");
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Sync with browser hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setPath(window.location.hash || "#/");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Fetch initial data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bookingsData, usersData] = await Promise.all([
        getBookings(),
        getUsers(),
      ]);

      setBookings(bookingsData);
      setUsers(usersData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Cannot load data from local database.");
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
      const updatedBooking = await updateBooking(id, updates);
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
      await deleteBooking(id);
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
    try {
      const newUser = await createUser(user);
      setUsers((prev) => [...prev, newUser]);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleLoginSuccess = (user: IUser) => {
    setAuthenticatedUser(user);
    localStorage.setItem("tri_shuttle_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuthenticatedUser(null);
    localStorage.removeItem("tri_shuttle_user");
  };

  // Helper to handle client-side SPA routing click using hash
  const navigateTo = (newPath: string) => {
    const hashPath = newPath.startsWith("/") && !newPath.startsWith("#") ? `#${newPath}` : newPath;
    window.location.hash = hashPath;
    setPath(hashPath);
  };

  const isAdminRoute = path.startsWith("#/admin") || path.startsWith("/admin");

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#2D2D2A] font-sans flex flex-col justify-between" id="app-wrapper">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-[#E6E6DF] shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer animate-fadeIn shrink-0" onClick={() => navigateTo("/")}>
            <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center shadow-inner">
              <span className="text-white font-serif italic text-xl">T</span>
            </div>
            <div>
              <h1 className="font-serif text-xl sm:text-2xl tracking-tight text-[#1A1A10] font-bold">
                test LAX
              </h1>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#8A8A7A] font-extrabold">
                {isAdminRoute ? "Operation Management Console" : "LAX Private Luxury Transport"}
              </p>
            </div>
          </div>

          {/* Customer Navigation Menu Items (Shown in header on desktop) */}
          {!isAdminRoute && (
            <nav className="hidden md:flex items-center gap-6 lg:gap-10 text-[11px] font-bold tracking-widest text-[#0066cc]">
              <button
                onClick={() => scrollToSection("booking-section")}
                className="hover:text-blue-800 transition-colors uppercase cursor-pointer py-1"
              >
                Booking
              </button>
              <button
                onClick={() => scrollToSection("about-section")}
                className="hover:text-blue-800 transition-colors uppercase cursor-pointer py-1"
              >
                About Us
              </button>
              <button
                onClick={() => scrollToSection("faq-section")}
                className="hover:text-blue-800 transition-colors uppercase cursor-pointer py-1"
              >
                Frequently Asked Questions
              </button>
            </nav>
          )}

          {/* User Status / Navigation Actions */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
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

      {/* Mobile navigation bar */}
      {!isAdminRoute && (
        <div className="md:hidden bg-white border-b border-[#E6E6DF] py-3 px-4 flex justify-around text-[10px] font-bold text-[#0066cc] uppercase tracking-widest sticky top-20 z-40 shadow-sm">
          <button onClick={() => scrollToSection("booking-section")} className="hover:text-blue-800 cursor-pointer">Booking</button>
          <button onClick={() => scrollToSection("about-section")} className="hover:text-blue-800 cursor-pointer">About Us</button>
          <button onClick={() => scrollToSection("faq-section")} className="hover:text-blue-800 cursor-pointer">FAQ</button>
        </div>
      )}

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
            <p className="font-serif text-lg text-slate-600">Synchronizing test LAX data...</p>
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
                    className="text-xs font-bold text-[#5A5A40] hover:underline underline-offset-4 flex items-center gap-1 shrink-0 animate-pulse"
                  >
                    <RefreshCw className="w-3 h-3 text-[#5A5A40]" /> Refresh Bookings
                  </button>
                </div>

                {/* Booking form section */}
                <div id="booking-section" className="scroll-mt-36">
                  <CustomerView
                    onBookingCreated={handleBookingCreated}
                    recentBookings={bookings}
                    onRefreshBookings={loadData}
                  />
                </div>

                {/* ABOUT US SECTION */}
                <section id="about-section" className="bg-white border border-[#E6E6DF] rounded-3xl p-6 sm:p-10 shadow-sm scroll-mt-36 mt-8 animate-fadeIn">
                  <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                      <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full border border-[#5A5A40]/20">
                        Who We Are
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A10] tracking-tight mt-3">
                        LAX Private Luxury Transport
                      </h2>
                      <div className="w-12 h-1 bg-[#5A5A40] mx-auto mt-4 rounded-full"></div>
                    </div>

                    <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                      <p className="leading-relaxed text-center italic font-serif text-slate-700 text-base">
                        "Delivering reliable, elegant, and secure private transportation services to and from LAX, John Wayne (SNA), and the Southern California region."
                      </p>
                      <p className="leading-relaxed">
                        At <strong>test LAX</strong>, we pride ourselves on offering professional executive transport solutions customized for discerning travelers. Whether you need a private shuttle from LAX to Little Saigon, Irvine, Garden Grove, or a premium hourly charter for special events, our modern fleet and experienced chauffeurs guarantee a stress-free travel experience.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                      <div className="bg-[#FAFBF7] border border-[#E6E6DF] p-5 rounded-2xl flex flex-col items-center text-center space-y-2">
                        <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white mb-2 shadow-sm">
                          <Clock className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-[#1A1A10] text-sm">Real-time Flight Tracking</h4>
                        <p className="text-xs text-slate-500">We monitor your flight status in real-time. If your plane is early or delayed, we adjust automatically.</p>
                      </div>

                      <div className="bg-[#FAFBF7] border border-[#E6E6DF] p-5 rounded-2xl flex flex-col items-center text-center space-y-2">
                        <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white mb-2 shadow-sm">
                          <Shield className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-[#1A1A10] text-sm">Professional Chauffeurs</h4>
                        <p className="text-xs text-slate-500">Fully vetted, background-checked, and highly trained drivers dedicated to your safety and comfort.</p>
                      </div>

                      <div className="bg-[#FAFBF7] border border-[#E6E6DF] p-5 rounded-2xl flex flex-col items-center text-center space-y-2">
                        <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white mb-2 shadow-sm">
                          <Award className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-[#1A1A10] text-sm">Premium Modern Fleet</h4>
                        <p className="text-xs text-slate-500">Travel in luxury with our range of meticulously maintained sedans, premium SUVs, and passenger vans.</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* FAQ SECTION */}
                <section id="faq-section" className="bg-white border border-[#E6E6DF] rounded-3xl p-6 sm:p-10 shadow-sm scroll-mt-36 mt-8 animate-fadeIn">
                  <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                      <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full border border-[#5A5A40]/20">
                        Got Questions?
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1A10] tracking-tight mt-3">
                        Frequently Asked Questions
                      </h2>
                      <div className="w-12 h-1 bg-[#5A5A40] mx-auto mt-4 rounded-full"></div>
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          q: "How do I meet my driver for an airport pickup at LAX?",
                          a: "For airport arrivals, your driver will track your flight real-time and text/WhatsApp you once you land. You will coordinate to meet at the passenger pickup pillars (e.g., Pillar 4B, Pillar 7A) at the arrivals level outside your terminal. We also offer optional inside meet & greet services."
                        },
                        {
                          q: "What happens if my flight is delayed?",
                          a: "There is no need to worry or contact us. We monitor all flights directly using the flight number you provide. Your driver will automatically adjust the dispatch time based on your actual arrival status."
                        },
                        {
                          q: "Can I request child car seats or booster seats?",
                          a: "Yes! We prioritize passenger safety. You can select the number of child car seats required during Step 1 of the booking form. We offer booster seats, forward-facing seats, and rear-facing infant seats."
                        },
                        {
                          q: "What is your cancellation and booking modification policy?",
                          a: "You can modify or cancel your booking free of charge up to 24 hours prior to the scheduled pickup time. Cancellations made within 24 hours may be subject to a service fee."
                        },
                        {
                          q: "What payment methods do you accept?",
                          a: "We accept secure credit card prepayments through our booking portal as well as cash payments directly to the driver at the completion of your ride. Please select your preference in Step 3."
                        }
                      ].map((item, idx) => {
                        const isOpen = activeFaq === idx;
                        return (
                          <div 
                            key={idx} 
                            className="border border-[#E6E6DF] rounded-2xl overflow-hidden transition-all duration-200"
                          >
                            <button
                              type="button"
                              onClick={() => setActiveFaq(isOpen ? null : idx)}
                              className="w-full px-6 py-4.5 bg-[#FAFBF7] flex justify-between items-center text-left font-bold text-sm text-[#1A1A10] hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                            >
                              <span>{item.q}</span>
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-[#5A5A40] shrink-0 ml-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[#5A5A40] shrink-0 ml-4" />
                              )}
                            </button>
                            {isOpen && (
                              <div className="px-6 py-4 bg-white border-t border-[#E6E6DF] text-xs sm:text-sm text-slate-600 leading-relaxed">
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {/* FOOTER SECTION */}
      <footer className="bg-white border-t border-[#E6E6DF] shrink-0">
        {!isAdminRoute ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 border-b border-[#E6E6DF] pb-8">
              {/* Column 1: Brand Info */}
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#5A5A40] rounded-full flex items-center justify-center shadow-inner shrink-0">
                    <span className="text-white font-serif italic text-base">T</span>
                  </div>
                  <span className="font-serif text-lg tracking-tight text-[#1A1A10] font-bold">
                    test LAX
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Premium private transport services between LAX, John Wayne Airport (SNA), Long Beach Airport (LGB), and major Southern California hubs.
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  TCP License: TCP-38291-A
                </p>
              </div>

              {/* Column 2: Navigation Links */}
              <div className="space-y-3 text-left">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A10]">Quick Navigation</h4>
                <ul className="space-y-2 text-xs">
                  <li>
                    <button onClick={() => scrollToSection("booking-section")} className="text-slate-500 hover:text-[#5A5A40] hover:underline cursor-pointer">
                      Book a Ride
                    </button>
                  </li>
                  <li>
                    <button onClick={() => scrollToSection("about-section")} className="text-slate-500 hover:text-[#5A5A40] hover:underline cursor-pointer">
                      About Us
                    </button>
                  </li>
                  <li>
                    <button onClick={() => scrollToSection("faq-section")} className="text-slate-500 hover:text-[#5A5A40] hover:underline cursor-pointer">
                      Frequently Asked Questions
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigateTo("/admin")} className="text-slate-500 hover:text-[#5A5A40] hover:underline cursor-pointer">
                      Admin Portal
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 3: Contact Info */}
              <div className="space-y-3 text-left">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A10]">Contact Dispatch</h4>
                <ul className="space-y-2 text-xs text-slate-500">
                  <li className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                    <span>+1 (800) 555-0100</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                    <span>dispatch@trishuttle.com</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                    <span>Westminster, CA 92683</span>
                  </li>
                </ul>
              </div>

              {/* Column 4: Services */}
              <div className="space-y-3 text-left">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A10]">Our Services</h4>
                <ul className="space-y-1.5 text-xs text-slate-500">
                  <li>• LAX Airport Transfers</li>
                  <li>• Orange County Executive Transit</li>
                  <li>• Hourly Private Car Charter</li>
                  <li>• Cruise Terminal Shuttles</li>
                  <li>• Disneyland Resort Pickups</li>
                </ul>
              </div>
            </div>

            {/* Bottom Status Sync Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[10px]">
              <div className="flex flex-wrap gap-4 sm:gap-6 text-[9px] uppercase tracking-widest text-[#8A8A7A] font-bold justify-center sm:justify-start">
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
                    Customer Website
                  </span>
                </span>
              </div>
              <p className="text-center sm:text-right font-medium">
                &copy; {new Date().getFullYear()} test LAX Private Luxury Transport. All rights reserved.
              </p>
            </div>
          </div>
        ) : (
          /* Simple Minimal Footer for Operations/Admin Route */
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
                  Internal Portal
                </span>
              </span>
            </div>
            <span className="text-[10px] text-[#5A5A40] font-medium italic underline underline-offset-4 text-center cursor-pointer" onClick={() => navigateTo("/")}>
              Go to Customer Booking Page
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}
