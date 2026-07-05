import React, { useState, useEffect } from "react";
import { IBooking } from "../types";
import { createBooking, updateBooking } from "../utils/db";
import { 
  Plane, Phone, User, Briefcase, MapPin, CheckCircle, 
  RefreshCw, AlertCircle, Sparkles, ArrowLeft, ArrowRight, 
  CreditCard, Wallet, Car, Mail, Check, Users, Baby
} from "lucide-react";

const POPULAR_SUGGESTIONS = [
  // Airports & Ports
  "LAX Airport - Los Angeles International Airport, CA",
  "SNA Airport - John Wayne Airport (Orange County), CA",
  "LGB Airport - Long Beach Airport, CA",
  "San Pedro Port - World Cruise Center, San Pedro, CA",
  "Long Beach Port - Carnival Cruise Terminal, Long Beach, CA",
  
  // Popular Cities / Regions
  "Westminster, California (Little Saigon)",
  "Irvine, California (Orange County)",
  "Garden Grove, California",
  "Santa Ana, California",
  "Anaheim, California",
  "Costa Mesa, California",
  "Newport Beach, California",
  "Huntington Beach, California",
  "Los Angeles Downtown (DTLA), CA",
  "Santa Monica, California",
  "Beverly Hills, California",
  "Hollywood, Los Angeles, CA",
  "Pasadena, California",
  "San Diego, California",

  // Landmarks & Theme Parks
  "Disneyland Resort - 1313 Disneyland Dr, Anaheim, CA",
  "Universal Studios Hollywood - Universal City, CA",
  "Knott's Berry Farm - Buena Park, CA",
  "South Coast Plaza - Costa Mesa, CA"
];

interface CustomerViewProps {
  onBookingCreated: (booking: IBooking) => void;
  recentBookings: IBooking[];
  onRefreshBookings: () => void;
}

export default function CustomerView({ onBookingCreated, recentBookings, onRefreshBookings }: CustomerViewProps) {
  // Stepper state: 1 = Details, 2 = Vehicle, 3 = Payment & Contact, 4 = Confirmation
  const [currentStep, setCurrentStep] = useState(1);

  // Tabs: "point-to-point" or "hourly"
  const [activeTab, setActiveTab] = useState<"point-to-point" | "hourly">("point-to-point");

  // Form Fields - Common
  const [pickupDate, setPickupDate] = useState("");
  const [pickupHour, setPickupHour] = useState("8");
  const [pickupMinute, setPickupMinute] = useState("00");
  const [pickupPeriod, setPickupPeriod] = useState("AM");
  const [passengers, setPassengers] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);
  const [childSeatCount, setChildSeatCount] = useState(0);

  // Point to Point Fields
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  // Hourly Fields
  const [hourlyStart, setHourlyStart] = useState("");
  const [hourlyDest, setHourlyDest] = useState("");
  const [hourlyReturn, setHourlyReturn] = useState("");
  const [hourlyHours, setHourlyHours] = useState(3);
  const [hourlyMinutes, setHourlyMinutes] = useState(0);

  // Secondary toggles for Hourly
  const [showHourlyLuggage, setShowHourlyLuggage] = useState(false);
  const [showHourlyCarSeat, setShowHourlyCarSeat] = useState(false);

  // Suggestions state & geocoding
  const [activeSuggestField, setActiveSuggestField] = useState<"pickup" | "dropoff" | "hourlyStart" | "hourlyDest" | "hourlyReturn" | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Step 2: Vehicle Selection
  const [selectedVehicle, setSelectedVehicle] = useState("Standard Luxury Sedan");

  // Step 3: Payment Method & Contact Details State
  const [paymentMethod, setPaymentMethod] = useState("Cash to Driver");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isAirportPickup, setIsAirportPickup] = useState(false);
  const [flightNumber, setFlightNumber] = useState("");
  const [terminal, setTerminal] = useState("Tom Bradley International Terminal (TBIT)");
  const [pickupPillar, setPickupPillar] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successBooking, setSuccessBooking] = useState<IBooking | null>(null);

  const [distance, setDistance] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);

  // Helper to calculate price based on vehicle name
  const getPriceForVehicle = (vehicleName: string, dist: number | null): number => {
    if (dist === null) return 0;
    if (vehicleName.includes("Sedan")) return Math.round(dist * 30);
    if (vehicleName.includes("SUV")) return Math.round(dist * 40);
    if (vehicleName.includes("Van")) return Math.round(dist * 50);
    return Math.round(dist * 30); // Default
  };

  // Date validation function
  const handleDateChange = (dateVal: string) => {
    if (!dateVal) {
      setPickupDate("");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse year to prevent incomplete typing triggers in Chrome
    const yearParts = dateVal.split("-");
    if (yearParts.length > 0) {
      const yearNum = parseInt(yearParts[0], 10);
      // Chrome pads incomplete years (e.g. typing '2' becomes '0002') during typing.
      // If the year is less than 1000, the user is still typing, so we temporarily skip validation.
      if (yearNum < 1000) {
        setPickupDate(dateVal);
        return;
      }
    }

    const selectedDate = new Date(dateVal + "T00:00:00");
    if (selectedDate < today) {
      alert("Cảnh báo: Ngày đón không thể ở trong quá khứ. Vui lòng chọn ngày hiện tại hoặc tương lai!\nWarning: Pickup date cannot be in the past. Please select today or a future date.");
      setPickupDate("");
    } else {
      setPickupDate(dateVal);
    }
  };

  // Stripe Payment Return Handler
  useEffect(() => {
    const handleStripeReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      const bookingId = params.get("bookingId");

      if (bookingId) {
        // Find the booking in recentBookings or fetch/load state
        const found = recentBookings.find((b) => b._id === bookingId);
        if (found) {
          if (payment === "success") {
            try {
              // Update payment method to show it was paid via Stripe
              const updated = await updateBooking(bookingId, {
                payment_method: "Credit Card (Paid via Stripe)"
              });
              setSuccessBooking(updated);
            } catch (err) {
              console.error("Failed to update booking payment status:", err);
              setSuccessBooking(found);
            }
          } else {
            setSuccessBooking(found);
            if (payment === "cancel") {
              setErrorMsg("Thanh toán thẻ đã bị hủy hoặc gặp lỗi. Vui lòng thanh toán lại hoặc chọn phương thức khác.");
            }
          }
          setCurrentStep(4);
          onRefreshBookings();

          // Clean up query parameters from the URL
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
      }
    };

    handleStripeReturn();
  }, [recentBookings, onRefreshBookings]);

  // Dynamic geocoding distance estimation Effect
  useEffect(() => {
    const from = activeTab === "point-to-point" ? pickupAddress : hourlyStart;
    const to = activeTab === "point-to-point" ? dropoffAddress : hourlyDest;

    if (!from.trim() || !to.trim()) {
      setDistance(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCalculatingDistance(true);
      try {
        // Geocode FROM
        const resFrom = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(from)}&limit=1`);
        const dataFrom = await resFrom.json();
        
        // Geocode TO
        const resTo = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(to)}&limit=1`);
        const dataTo = await resTo.json();

        if (dataFrom.features?.[0] && dataTo.features?.[0]) {
          const [lon1, lat1] = dataFrom.features[0].geometry.coordinates;
          const [lon2, lat2] = dataTo.features[0].geometry.coordinates;

          const R = 3958.8; // Earth's radius in miles
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const straightDistance = R * c;
          // Driving distance factor (approx 1.3x straight line)
          const drivingDistance = Math.round(straightDistance * 1.3 * 10) / 10;
          setDistance(Math.max(1, drivingDistance));
        } else {
          throw new Error("Could not resolve coordinates");
        }
      } catch (e) {
        console.warn("Using fallback distance calculation:", e);
        const hash = (str: string) => {
          let h = 0;
          for (let i = 0; i < str.length; i++) {
            h = (h << 5) - h + str.charCodeAt(i);
            h |= 0;
          }
          return Math.abs(h);
        };
        const d = (hash(from) + hash(to)) % 40 + 5;
        setDistance(d);
      } finally {
        setCalculatingDistance(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [pickupAddress, dropoffAddress, hourlyStart, hourlyDest, activeTab]);

  // Calculate dynamic end time for Hourly Service
  const [calculatedEndTime, setCalculatedEndTime] = useState("11:00 AM");

  useEffect(() => {
    // Parse start time
    const startH = parseInt(pickupHour, 10);
    const startM = parseInt(pickupMinute, 10);
    
    let hour24 = startH % 12;
    if (pickupPeriod === "PM") hour24 += 12;

    const totalStartMinutes = hour24 * 60 + startM;
    const totalDurationMinutes = (hourlyHours * 60) + hourlyMinutes;
    const totalEndMinutes = (totalStartMinutes + totalDurationMinutes) % 1440;

    const endHour24 = Math.floor(totalEndMinutes / 60);
    const endMin = totalEndMinutes % 60;

    const endPeriod = endHour24 >= 12 ? "PM" : "AM";
    let endHour12 = endHour24 % 12;
    if (endHour12 === 0) endHour12 = 12;

    const endMinStr = endMin.toString().padStart(2, "0");
    setCalculatedEndTime(`${endHour12}:${endMinStr} ${endPeriod}`);
  }, [pickupHour, pickupMinute, pickupPeriod, hourlyHours, hourlyMinutes]);

  // Helper to determine the current active input value for autocomplete suggestions
  const getActiveFieldValue = () => {
    switch (activeSuggestField) {
      case "pickup": return pickupAddress;
      case "dropoff": return dropoffAddress;
      case "hourlyStart": return hourlyStart;
      case "hourlyDest": return hourlyDest;
      case "hourlyReturn": return hourlyReturn;
      default: return "";
    }
  };

  const activeValue = getActiveFieldValue();

  // Async geocoding autocomplete with debounce
  useEffect(() => {
    if (!activeSuggestField) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    if (!activeValue.trim()) {
      // Default quick-select options
      setSuggestions([
        "LAX Airport - Los Angeles International Airport, CA",
        "Westminster, California (Little Saigon)",
        "Irvine, California (Orange County)",
        "Disneyland Resort - 1313 Disneyland Dr, Anaheim, CA",
        "SNA Airport - John Wayne Airport (Orange County), CA"
      ]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        // location_bias centered near LAX for Southern California prioritization
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(activeValue)}&limit=8&lat=33.9416&lon=-118.4085`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch from Photon API");
        
        const data = await res.json();
        
        const items = data.features.map((f: any) => {
          const p = f.properties;
          const house = p.housenumber || "";
          const street = p.street || "";
          const name = p.name || "";
          const city = p.city || "";
          const state = p.state || "";
          
          let addressParts: string[] = [];
          
          // Format landmark and street address nicely
          if (name && name !== street) {
            addressParts.push(name);
          }
          if (house || street) {
            addressParts.push(`${house} ${street}`.trim());
          }
          if (city) {
            addressParts.push(city);
          }
          const stateCode = state.toLowerCase().includes("california") ? "CA" : (p.statecode || state);
          if (stateCode) {
            addressParts.push(stateCode);
          }
          
          return addressParts.filter(Boolean).join(", ");
        });

        const uniqueItems = Array.from(new Set(items)).filter(Boolean) as string[];
        
        if (uniqueItems.length > 0) {
          setSuggestions(uniqueItems);
        } else {
          // Fallback to local filter if no online geocoding matches
          const localFiltered = POPULAR_SUGGESTIONS.filter((s) =>
            s.toLowerCase().includes(activeValue.toLowerCase())
          );
          setSuggestions(localFiltered);
        }
      } catch (err) {
        console.warn("Geocoding fetch error, using local fallback list:", err);
        const localFiltered = POPULAR_SUGGESTIONS.filter((s) =>
          s.toLowerCase().includes(activeValue.toLowerCase())
        );
        setSuggestions(localFiltered);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300); // 300ms type-ahead debounce

    return () => clearTimeout(timer);
  }, [activeSuggestField, activeValue]);

  const terminals = [
    "Tom Bradley International Terminal (TBIT)",
    "Terminal 1",
    "Terminal 2",
    "Terminal 3",
    "Terminal 4",
    "Terminal 5",
    "Terminal 6",
    "Terminal 7",
    "Terminal 8",
    "N/A - Private Residence"
  ];

  const vehiclesList = [
    {
      name: "Standard Luxury Sedan",
      models: "Lexus ES, Cadillac CT6, Mercedes E-Class",
      capacity: "Up to 3 passengers, max 2 large bags",
      badge: "Luxury & Style",
      color: "from-slate-700 to-slate-900",
      limits: { pax: 3, luggage: 2 }
    },
    {
      name: "Premium Luxury SUV",
      models: "Lincoln Navigator, Cadillac Escalade, GMC Yukon",
      capacity: "Up to 6 passengers, max 5 large bags",
      badge: "Spacious & Premium",
      color: "from-amber-700 to-amber-900",
      limits: { pax: 6, luggage: 5 }
    },
    {
      name: "High-Capacity Passenger Van",
      models: "Ford Transit Premium, Mercedes Sprinter",
      capacity: "Up to 14 passengers, max 12 large bags",
      badge: "Large Groups & Heavy Luggage",
      color: "from-emerald-800 to-teal-950",
      limits: { pax: 14, luggage: 12 }
    }
  ];

  // Logic to suggest a vehicle category based on inputs
  const getSuggestedVehicleName = () => {
    if (passengers > 6 || luggageCount > 5) {
      return "High-Capacity Passenger Van";
    }
    if (passengers > 3 || luggageCount > 2) {
      return "Premium Luxury SUV";
    }
    return "Standard Luxury Sedan";
  };

  const suggestedVehicleName = getSuggestedVehicleName();

  // Validate step 1 and proceed to step 2
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (pickupDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(pickupDate + "T00:00:00");
      if (selectedDate < today) {
        alert("Cảnh báo: Ngày đón không thể ở trong quá khứ. Vui lòng chọn lại ngày hiện tại hoặc tương lai!");
        setPickupDate("");
        setErrorMsg("Ngày đón không thể ở trong quá khứ.");
        return;
      }
    }

    if (activeTab === "point-to-point") {
      if (!pickupAddress.trim() || !dropoffAddress.trim() || !pickupDate) {
        setErrorMsg("Please fill in pickup, drop-off address and pickup date.");
        return;
      }
    } else {
      if (!hourlyStart.trim() || !hourlyDest.trim() || !pickupDate) {
        setErrorMsg("Please fill in start location, destination and pickup date.");
        return;
      }
    }

    // Default select the recommended vehicle category
    setSelectedVehicle(suggestedVehicleName);
    setCurrentStep(2);
  };

  // Submit final booking request
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      setErrorMsg("Please fill in Passenger Name, Phone Number, and Email.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const isHourly = activeTab === "hourly";
    const mappedPickup = isHourly ? hourlyStart : pickupAddress;
    
    let mappedDropoff = isHourly ? hourlyDest : dropoffAddress;
    if (isHourly) {
      mappedDropoff += ` (Hourly Service: ${hourlyHours} hrs ${hourlyMinutes} mins`;
      if (hourlyReturn.trim()) {
        mappedDropoff += `, Return: ${hourlyReturn}`;
      }
      mappedDropoff += `)`;
    } else if (isRoundTrip) {
      mappedDropoff += " (Round Trip)";
    }

    const timeString = `${pickupHour}:${pickupMinute} ${pickupPeriod}`;
    const mappedPillar = isAirportPickup && pickupPillar.trim() 
      ? `Pillar: ${pickupPillar} (Date: ${pickupDate} @ ${timeString}, Pax: ${passengers}, Child Seats: ${childSeatCount})`
      : `Date: ${pickupDate} @ ${timeString}, Pax: ${passengers}, Child Seats: ${childSeatCount}`;

    const calculatedPrice = getPriceForVehicle(selectedVehicle, distance);

    try {
      const newBooking = await createBooking({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        flight_number: isAirportPickup && flightNumber.trim() ? flightNumber.toUpperCase() : "N/A",
        airport_terminal: isAirportPickup ? terminal : "N/A",
        pickup_pillar: mappedPillar,
        dropoff_address: `${mappedPickup} -> ${mappedDropoff}`,
        luggage_count: luggageCount,
        payment_method: paymentMethod,
        selected_vehicle: selectedVehicle,
        status: "Pending",
        driver_id: null,
        estimated_distance: distance !== null ? distance : undefined,
        estimated_price: calculatedPrice || undefined
      });

      onBookingCreated(newBooking);

      if (paymentMethod === "Credit Card" && calculatedPrice) {
        try {
          const response = await fetch("/api/create-checkout-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              amount: calculatedPrice,
              bookingId: newBooking._id,
              description: `Dịch vụ đặt xe đưa đón (${selectedVehicle})`
            })
          });

          let errMessage = "Không thể khởi tạo phiên thanh toán Stripe.";
          if (!response.ok) {
            try {
              const errData = await response.json();
              errMessage = errData.error || errMessage;
            } catch {
              try {
                const textBody = await response.text();
                errMessage = textBody || errMessage;
              } catch {}
            }
            throw new Error(errMessage);
          }

          let sessionData;
          try {
            sessionData = await response.json();
          } catch (jsonErr) {
            throw new Error("Phản hồi từ máy chủ không hợp lệ (không phải định dạng JSON).");
          }

          if (sessionData.url) {
            // Redirect to Stripe checkout breaking out of iframes
            if (window.top) {
              window.top.location.href = sessionData.url;
            } else {
              window.location.href = sessionData.url;
            }
            return;
          } else {
            throw new Error("Không nhận được đường dẫn thanh toán hợp lệ từ hệ thống.");
          }
        } catch (checkoutErr: any) {
          console.error("Stripe Checkout Error:", checkoutErr);
          setErrorMsg(`Không thể tạo phiên thanh toán Stripe: ${checkoutErr.message}`);
          // Fall back to showing Step 4 locally in case of failure
          setSuccessBooking(newBooking);
          setCurrentStep(4);
        }
      } else {
        setSuccessBooking(newBooking);
        setCurrentStep(4);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while creating booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setFlightNumber("");
    setPickupPillar("");
    setPickupAddress("");
    setDropoffAddress("");
    setHourlyStart("");
    setHourlyDest("");
    setHourlyReturn("");
    setIsRoundTrip(false);
    setLuggageCount(0);
    setChildSeatCount(0);
    setPassengers(1);
    setSuccessBooking(null);
    setCurrentStep(1);
  };

  const myTrackerBooking = successBooking
    ? recentBookings.find((b) => b._id === successBooking._id) || successBooking
    : null;

  // Render geocoded autocomplete dropdown below relative parent input
  const renderAutocomplete = (
    fieldId: "pickup" | "dropoff" | "hourlyStart" | "hourlyDest" | "hourlyReturn",
    setValue: (val: string) => void
  ) => {
    if (activeSuggestField !== fieldId) return null;
    if (suggestions.length === 0 && !loadingSuggestions) return null;

    return (
      <div className="absolute left-0 right-0 mt-1 bg-[#071324] border border-slate-700/80 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800/60 text-xs">
        {loadingSuggestions && (
          <div className="px-4 py-2 text-slate-400 italic flex items-center gap-2 bg-[#071324]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            Searching real-time geocoder...
          </div>
        )}
        {suggestions.map((s) => (
          <div
            key={s}
            onMouseDown={() => {
              setValue(s);
              setActiveSuggestField(null);
            }}
            className="px-4 py-2.5 hover:bg-[#1E3A8A] text-slate-200 cursor-pointer transition-colors text-left"
          >
            {s}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 font-sans text-slate-100" id="customer-view-root">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <span className="bg-amber-500/10 text-amber-500 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-amber-500/20">
          test LAX Premium
        </span>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-3">
          Book Private LAX Airport & Luxury Shuttle
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
          Exclusive premium transport between Los Angeles International Airport (LAX), Little Saigon, Irvine, and surrounding Southern California regions.
        </p>
      </div>

      {/* 4-Step Stepper Progress Bar */}
      <div className="mb-8 bg-[#0b1c33] border border-[#1b2b42] rounded-3xl p-5 shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { step: 1, label: "Step 1: Details", desc: "When & Where" },
            { step: 2, label: "Step 2: Vehicle", desc: "Choose Fleet Class" },
            { step: 3, label: "Step 3: Payment", desc: "Payment & Contact" },
            { step: 4, label: "Step 4: Confirm", desc: "Booking Status" }
          ].map((s) => {
            const isCompleted = currentStep > s.step || (s.step === 4 && myTrackerBooking !== null);
            const isActive = currentStep === s.step && (s.step !== 4 || myTrackerBooking === null);
            return (
              <div key={s.step} className="flex items-center gap-3 w-full">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shrink-0 ${
                  isCompleted ? "bg-emerald-500 text-white" :
                  isActive ? "bg-blue-600 text-white ring-4 ring-blue-500/20" :
                  "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : s.step}
                </div>
                <div className="text-left truncate">
                  <p className={`text-xs font-bold uppercase tracking-wider ${isActive || isCompleted ? "text-slate-200" : "text-slate-500"}`}>{s.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Form Body / Success Tracker */}
      <div className="grid grid-cols-1 gap-6">
        
        {errorMsg && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs rounded-xl p-3.5 flex items-center gap-2 max-w-lg mx-auto w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Provide Details */}
        {currentStep === 1 && (
          <div className="bg-[#0b1c33] border border-[#1b2b42] rounded-3xl p-6 shadow-2xl animate-fadeIn max-w-2xl mx-auto w-full" id="customer-booking-form">
            {/* Form Tab Headers */}
            <div className="flex bg-[#071324] p-1 rounded-2xl mb-6 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("point-to-point");
                  setErrorMsg("");
                }}
                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "point-to-point"
                    ? "bg-[#1E3A8A] text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Airport & Point To Point
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("hourly");
                  setErrorMsg("");
                }}
                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "hourly"
                    ? "bg-[#1E3A8A] text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Hourly
              </button>
            </div>

            <form onSubmit={handleProceedToStep2} className="space-y-5">
              {activeTab === "point-to-point" ? (
                /* Point to Point Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" /> From
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. LAX Airport, Terminal 4 or Pickup address"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        onFocus={() => setActiveSuggestField("pickup")}
                        onBlur={() => setTimeout(() => setActiveSuggestField(null), 200)}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                        required
                      />
                      {renderAutocomplete("pickup", setPickupAddress)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" /> To
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Dropoff Address (e.g. Westminster Little Saigon, Irvine)"
                        value={dropoffAddress}
                        onChange={(e) => setDropoffAddress(e.target.value)}
                        onFocus={() => setActiveSuggestField("dropoff")}
                        onBlur={() => setTimeout(() => setActiveSuggestField(null), 200)}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                        required
                      />
                      {renderAutocomplete("dropoff", setDropoffAddress)}
                    </div>
                  </div>
                </div>
              ) : (
                /* Hourly Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" /> Start Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Pickup address"
                        value={hourlyStart}
                        onChange={(e) => setHourlyStart(e.target.value)}
                        onFocus={() => setActiveSuggestField("hourlyStart")}
                        onBlur={() => setTimeout(() => setActiveSuggestField(null), 200)}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                        required
                      />
                      {renderAutocomplete("hourlyStart", setHourlyStart)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" /> Destination Address
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Destination Address"
                        value={hourlyDest}
                        onChange={(e) => setHourlyDest(e.target.value)}
                        onFocus={() => setActiveSuggestField("hourlyDest")}
                        onBlur={() => setTimeout(() => setActiveSuggestField(null), 200)}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                        required
                      />
                      {renderAutocomplete("hourlyDest", setHourlyDest)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Return Location (Optional)</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Same as pickup or empty"
                        value={hourlyReturn}
                        onChange={(e) => setHourlyReturn(e.target.value)}
                        onFocus={() => setActiveSuggestField("hourlyReturn")}
                        onBlur={() => setTimeout(() => setActiveSuggestField(null), 200)}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                      {renderAutocomplete("hourlyReturn", setHourlyReturn)}
                    </div>
                  </div>
                </div>
              )}

              {/* Pickup Date & Time Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pickup Date</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-4 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pickup Time</label>
                  <div className="flex gap-2">
                    <select
                      value={pickupHour}
                      onChange={(e) => setPickupHour(e.target.value)}
                      className="flex-1 bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-2 text-center text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    
                    <select
                      value={pickupMinute}
                      onChange={(e) => setPickupMinute(e.target.value)}
                      className="flex-1 bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-2 text-center text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <select
                      value={pickupPeriod}
                      onChange={(e) => setPickupPeriod(e.target.value)}
                      className="flex-1 bg-[#071324] border border-slate-700/80 rounded-xl py-3 px-2 text-center text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Point-to-Point or Hourly Specific Inputs */}
              {activeTab === "point-to-point" ? (
                /* Point-to-Point has no tab-specific extra inputs here since we moved sliders down */
                null
              ) : (
                /* Hourly Duration Selector */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Hours</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={hourlyHours}
                        onChange={(e) => setHourlyHours(Number(e.target.value))}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 text-center text-slate-100 text-sm font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Minutes</label>
                      <select
                        value={hourlyMinutes}
                        onChange={(e) => setHourlyMinutes(Number(e.target.value))}
                        className="w-full bg-[#071324] border border-slate-700/80 rounded-xl py-3 text-center text-slate-100 text-sm font-semibold focus:outline-none"
                      >
                        <option value={0}>0</option>
                        <option value={15}>15</option>
                        <option value={30}>30</option>
                        <option value={45}>45</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-[#071324]/50 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-400">Duration Ends:</span>
                    <span className="font-bold text-amber-400 font-mono text-sm">End time: {calculatedEndTime}</span>
                  </div>
                </div>
              )}

              {/* UNIFIED PASSENGERS, LUGGAGE & CHILD SEATS SLIDERS */}
              <div className="space-y-4 pt-4 border-t border-slate-800/60">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Passengers & Extras Info
                </h4>

                <div className="space-y-4 bg-[#071324]/50 border border-slate-800 p-4 rounded-2xl">
                  {/* Passengers Slider */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        Passengers:
                      </span>
                      <span className="text-blue-400 text-sm font-mono">{passengers} Pax</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="14"
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold px-0.5 mt-1">
                      <span>1</span>
                      <span>4</span>
                      <span>6</span>
                      <span>10</span>
                      <span>14</span>
                    </div>
                  </div>

                  {/* Luggage Slider */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                        Luggage Bags:
                      </span>
                      <span className="text-blue-400 text-sm font-mono">{luggageCount} Bags</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={luggageCount}
                      onChange={(e) => setLuggageCount(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold px-0.5 mt-1">
                      <span>0</span>
                      <span>2</span>
                      <span>5</span>
                      <span>8</span>
                      <span>12</span>
                    </div>
                  </div>

                  {/* Child Seats Slider */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Baby className="w-3.5 h-3.5 text-blue-400" />
                        Child / Car Seats:
                      </span>
                      <span className="text-blue-400 text-sm font-mono">{childSeatCount} Seats</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={childSeatCount}
                      onChange={(e) => setChildSeatCount(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold px-0.5 mt-1">
                      <span>0</span>
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                    </div>
                  </div>
                </div>

                {/* SUGGESTION / RECOMMENDATION NOTICE */}
                <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Suggested Vehicle Class</p>
                    <p className="text-xs text-slate-200 mt-0.5">
                      Based on your selection, we recommend: <span className="font-bold text-amber-400 underline decoration-dotted">{suggestedVehicleName}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Point-to-Point Round Trip Toggle */}
              {activeTab === "point-to-point" && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 font-serif">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Round Trip?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRoundTrip}
                      onChange={(e) => setIsRoundTrip(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}

              {/* Dynamic Distance Preview (Price removed from Step 1 as requested) */}
              {(distance !== null || calculatingDistance) && (
                <div className="p-4 bg-[#071324] border border-slate-700/60 rounded-2xl animate-fadeIn space-y-3 mt-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />
                      Estimated Distance:
                    </span>
                    {calculatingDistance ? (
                      <span className="text-slate-400 italic flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                        Calculating...
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-400 text-sm font-mono">{distance} miles</span>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg mt-4 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Select Vehicle <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Select Vehicle */}
        {currentStep === 2 && (
          <div className="bg-[#0b1c33] border border-[#1b2b42] rounded-3xl p-6 shadow-2xl animate-fadeIn max-w-2xl mx-auto w-full">
            <h3 className="text-lg font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-500" />
              Select Your Vehicle Class
            </h3>
            
            <p className="text-xs text-slate-400 mt-2">
              We recommend the category based on your passenger ({passengers}) and luggage ({luggageCount}) counts.
            </p>

            <div className="space-y-4 mt-4">
              {vehiclesList.map((v) => {
                const isRecommended = suggestedVehicleName === v.name;
                const isSelected = selectedVehicle === v.name;

                return (
                  <div
                    key={v.name}
                    onClick={() => setSelectedVehicle(v.name)}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${v.color} border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected 
                        ? "border-blue-500 ring-2 ring-blue-500/20 scale-[1.01]" 
                        : "border-white/5 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest text-slate-200">
                          {v.badge}
                        </span>
                        {isRecommended && (
                          <span className="text-[9px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? "bg-blue-600 border-blue-500" : "border-slate-600"}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <h4 className="text-base font-extrabold tracking-tight flex items-center gap-1.5">
                        <Car className="w-4 h-4 text-amber-400" /> {v.name}
                      </h4>
                      {distance !== null && (
                        <span className="text-base font-extrabold text-slate-100 bg-white/10 px-2.5 py-1 rounded-xl font-mono">
                          ${getPriceForVehicle(v.name, distance)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 italic">{v.models}</p>
                    
                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-2 text-xs text-slate-200">
                      <span>Capacity: {v.capacity}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Details
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Payment <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Choose Payment & Contact Info */}
        {currentStep === 3 && (
          <div className="bg-[#0b1c33] border border-[#1b2b42] rounded-3xl p-6 shadow-2xl animate-fadeIn max-w-2xl mx-auto w-full">
            <h3 className="text-lg font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Payment & Contact Details
            </h3>

            <form onSubmit={handleFinalSubmit} className="space-y-5 mt-4">
              
              {/* Payment Methods Choice */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Choose Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: "Cash to Driver", desc: "Pay at destination", icon: Wallet },
                    { name: "Credit Card", desc: "Pay securely online", icon: CreditCard },
                    { name: "Mobile App Transfer", desc: "Apple Pay / WhatsApp", icon: Phone }
                  ].map((pm) => {
                    const isSelected = paymentMethod === pm.name;
                    return (
                      <button
                        type="button"
                        key={pm.name}
                        onClick={() => setPaymentMethod(pm.name)}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected 
                            ? "bg-blue-950/60 border-blue-500 text-slate-100 ring-1 ring-blue-500/20" 
                            : "bg-[#071324] border-slate-700/80 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <pm.icon className={`w-4 h-4 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                        <span className="text-[10px] font-bold uppercase">{pm.name}</span>
                        <span className="text-[9px] font-light text-slate-400 leading-none">{pm.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Passenger Contact Form */}
              <div className="space-y-4 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Passenger Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +1 714-555-0100 (WhatsApp)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. customer@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Conditional Airport Pickup Form Checkbox */}
              <div className="p-4 bg-[#071324]/50 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between font-serif">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pickup is from Airport? (Requires Flight Details)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAirportPickup}
                      onChange={(e) => setIsAirportPickup(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {isAirportPickup && (
                  <div className="space-y-4 pt-3 border-t border-slate-800/80 animate-fadeIn text-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Flight Number</label>
                      <div className="relative">
                        <Plane className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required={isAirportPickup}
                          placeholder="e.g. VN521, AA2412"
                          value={flightNumber}
                          onChange={(e) => setFlightNumber(e.target.value)}
                          className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">LAX Terminal</label>
                      <select
                        value={terminal}
                        onChange={(e) => setTerminal(e.target.value)}
                        className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                      >
                        {terminals.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {activeTab === "point-to-point" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pickup Pillar (If Known)</label>
                        <input
                          type="text"
                          placeholder="e.g. Pillar 4B, 2A"
                          value={pickupPillar}
                          onChange={(e) => setPickupPillar(e.target.value)}
                          className="w-full bg-[#071324] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nav Buttons */}
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Vehicle
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#C8102E] hover:bg-[#a6192e] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Confirming...
                    </>
                  ) : (
                    "Confirm & Book Luxury Shuttle"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 4: Confirmation / Success Tracking */}
        {currentStep === 4 && myTrackerBooking && (
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden max-w-2xl mx-auto w-full" id="booking-success-card">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <CheckCircle className="w-8 h-8" />
              <div>
                <h3 className="font-bold text-lg text-slate-100">Booking Requested Successfully!</h3>
                <p className="text-xs text-slate-400">Request registered on dispatch queue</p>
              </div>
            </div>

            {/* Status Tracker */}
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ride Status:</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  myTrackerBooking.status === "Pending" ? "bg-amber-500/20 text-amber-400 animate-pulse" :
                  myTrackerBooking.status === "Active" ? "bg-blue-500/20 text-blue-400" :
                  myTrackerBooking.status === "Completed" ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-rose-500/20 text-rose-400"
                }`}>
                  {myTrackerBooking.status === "Pending" && "● Pending Dispatch Approval"}
                  {myTrackerBooking.status === "Active" && "● Approved & Driver Assigned"}
                  {myTrackerBooking.status === "Completed" && "✓ Completed"}
                  {myTrackerBooking.status === "Cancelled" && "✕ Cancelled"}
                </span>
              </div>

              <div className="space-y-3 pt-2 text-sm border-t border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Booking ID:</span>
                  <span className="font-mono text-slate-200">{myTrackerBooking._id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Passenger:</span>
                  <span className="font-semibold text-slate-200">{myTrackerBooking.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-200">{myTrackerBooking.customer_email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Selected Vehicle:</span>
                  <span className="font-semibold text-blue-400">{myTrackerBooking.selected_vehicle || selectedVehicle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="font-semibold text-slate-200">{myTrackerBooking.payment_method || paymentMethod}</span>
                </div>
                {myTrackerBooking.flight_number !== "N/A" && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Flight Number:</span>
                    <span className="font-semibold text-amber-400">{myTrackerBooking.flight_number}</span>
                  </div>
                )}
                {myTrackerBooking.airport_terminal !== "N/A" && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Terminal:</span>
                    <span className="text-slate-200">{myTrackerBooking.airport_terminal}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Pillar / Ride Details:</span>
                  <span className="text-slate-200 text-right truncate max-w-[250px]" title={myTrackerBooking.pickup_pillar}>{myTrackerBooking.pickup_pillar || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Journey:</span>
                  <span className="text-slate-200 text-right truncate max-w-[250px]" title={myTrackerBooking.dropoff_address}>{myTrackerBooking.dropoff_address}</span>
                </div>
                {myTrackerBooking.estimated_distance && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimated Distance:</span>
                    <span className="font-semibold text-emerald-400 font-mono">{myTrackerBooking.estimated_distance} miles</span>
                  </div>
                )}
                {myTrackerBooking.estimated_price && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Price:</span>
                    <span className="font-bold text-amber-400 text-base font-mono">${myTrackerBooking.estimated_price}</span>
                  </div>
                )}
              </div>

              {/* Driver Box */}
              {myTrackerBooking.status === "Active" && myTrackerBooking.driver_id && (
                <div className="mt-4 p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Assigned Driver:</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-100">
                        {myTrackerBooking.driver_id === "driver_john_miller" ? "John Miller" : "Robert Chen"}
                      </p>
                      <p className="text-xs text-slate-300">
                        Phone: {myTrackerBooking.driver_id === "driver_john_miller" ? "+1 714-555-0192" : "+1 949-555-0143"}
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/${(myTrackerBooking.driver_id === "driver_john_miller" ? "17145550192" : "19495550143")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" /> Chat WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>

            {myTrackerBooking.status === "Pending" && (
              <div className="text-xs text-slate-400 flex items-start gap-1.5 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  test dispatcher is currently checking your flight schedule. A driver will be assigned shortly. Please keep your communication channel active.
                </span>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={onRefreshBookings}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-600"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Status
              </button>
              <button
                onClick={handleResetForm}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold py-2.5 rounded-xl transition-all"
              >
                Book Another Ride
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
