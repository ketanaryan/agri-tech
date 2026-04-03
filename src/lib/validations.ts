import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export const createFarmerSchema = z.object({
  name: z.string().min(2, { message: "Name is required" }),
  phone: z.string().min(10, { message: "Valid phone number is required" }),
  address: z.string().optional(),
})

export const createBookingSchema = z.object({
  farmer_id: z.string().uuid(),
  item_id: z.string().uuid(),
  qty: z.number().min(1, { message: "Quantity must be at least 1" }),
  total_amount: z.number().min(0),
  booking_amount: z.number().min(0),
  balance_amount: z.number().min(0),
})
