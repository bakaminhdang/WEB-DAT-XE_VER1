import React, { useState } from "react";
import { KeyRound, Mail, ArrowRight, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";
import { IUser } from "../types";

interface LoginViewProps {
  onLoginSuccess: (user: IUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter both Email and Password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Incorrect email or password.");
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || "Cannot connect to the authentication system.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to quick-fill credentials
  const fillCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto w-full" id="login-container">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#5A5A40] rounded-full flex items-center justify-center shadow-inner mx-auto mb-4 animate-bounce">
          <span className="text-white font-serif italic text-xl">T</span>
        </div>
        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#1A1A10]">
          Tri Shuttle Console
        </h2>
        <p className="text-xs uppercase tracking-widest text-[#8A8A7A] font-extrabold mt-1">
          Airport Dispatch & Operations Console
        </p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white border border-[#E6E6DF] rounded-[32px] p-8 shadow-md w-full relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#5A5A40] via-[#8A8A7A] to-[#5A5A40]"></div>
        
        <h3 className="font-serif text-xl font-bold text-[#1A1A10] mb-6 text-center">
          Admin Portal Sign In
        </h3>

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5 text-xs animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Login Failed</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-[#5A5A40] uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#8A8A7A]">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@trishuttle.com"
                className="w-full bg-[#FAFBF7] border border-[#D4D4C8] rounded-2xl py-3 pl-10 pr-4 text-sm text-[#2D2D2A] focus:outline-none focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-[#5A5A40] uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#8A8A7A]">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#FAFBF7] border border-[#D4D4C8] rounded-2xl py-3 pl-10 pr-4 text-sm text-[#2D2D2A] focus:outline-none focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] transition-all"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[#5A5A40] hover:bg-[#484833] text-white font-bold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-widest shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 ${
              loading ? "opacity-80 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Testing Helper Card */}
      <div className="bg-[#FAFBF7] border border-[#E6E6DF] rounded-[24px] p-5 mt-6 w-full text-xs shadow-sm">
        <h4 className="font-bold text-[#5A5A40] uppercase tracking-wider flex items-center gap-1.5 mb-3 font-serif">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Demo Accounts
        </h4>
        <div className="space-y-3">
          <div 
            onClick={() => fillCredentials("admin@trishuttle.com", "admin123")}
            className="p-2.5 bg-white border border-[#E6E6DF] rounded-xl cursor-pointer hover:border-[#5A5A40] transition-all flex justify-between items-center group"
          >
            <div>
              <p className="font-bold text-slate-800">1. System Administrator (Admin)</p>
              <p className="text-[10px] text-slate-500 font-mono">admin@trishuttle.com / admin123</p>
            </div>
            <span className="text-[10px] text-[#5A5A40] font-bold group-hover:translate-x-0.5 transition-all">Select &rarr;</span>
          </div>

          <div 
            onClick={() => fillCredentials("john.miller@trishuttle.com", "driver123")}
            className="p-2.5 bg-white border border-[#E6E6DF] rounded-xl cursor-pointer hover:border-[#5A5A40] transition-all flex justify-between items-center group"
          >
            <div>
              <p className="font-bold text-slate-800">2. Driver: John Miller</p>
              <p className="text-[10px] text-slate-500 font-mono">john.miller@trishuttle.com / driver123</p>
            </div>
            <span className="text-[10px] text-[#5A5A40] font-bold group-hover:translate-x-0.5 transition-all">Select &rarr;</span>
          </div>

          <div 
            onClick={() => fillCredentials("robert.chen@trishuttle.com", "driver123")}
            className="p-2.5 bg-white border border-[#E6E6DF] rounded-xl cursor-pointer hover:border-[#5A5A40] transition-all flex justify-between items-center group"
          >
            <div>
              <p className="font-bold text-slate-800">3. Driver: Robert Chen</p>
              <p className="text-[10px] text-slate-500 font-mono">robert.chen@trishuttle.com / driver123</p>
            </div>
            <span className="text-[10px] text-[#5A5A40] font-bold group-hover:translate-x-0.5 transition-all">Select &rarr;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
