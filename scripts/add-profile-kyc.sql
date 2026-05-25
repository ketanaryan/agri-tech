-- Add KYC columns to profiles table for internal staff (FieldOfficer, Leader, Telecaller)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS aadhar_card text,
ADD COLUMN IF NOT EXISTS pan_card text;
