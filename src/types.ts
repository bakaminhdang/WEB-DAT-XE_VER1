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
  estimated_distance?: number;
  estimated_price?: number;
  createdAt: string;
  updatedAt: string;
}

export type RoleType = "Customer" | "Admin" | "Driver";
