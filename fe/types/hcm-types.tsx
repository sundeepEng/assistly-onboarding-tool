export interface Shift {
  id?: number;
  user_id?: string | string[]; // Accepts single UUID or an array of UUIDs
  shift_status?: "available" | "timeoff" | "vacation"; // Updated to always be a string
  shift_start_time?: string; // ISO timestamp
  shift_end_time?: string; // ISO timestamp
  is_unavailability_approved?: boolean;
  unavailability_reason?: string;
  pay_rate?: number;
  pay_frequency?: string;
  notes?: string;
  clock_in_timestamp?: string; // ISO timestamp
  clock_out_timestamp?: string; // ISO timestamp
  user_name: string;
  shift_color?: string; // Added for UI coloring
}
