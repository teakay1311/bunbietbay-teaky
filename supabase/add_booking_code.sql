-- Migration: Add booking_code to activities table
-- Run this on Supabase SQL Editor after deploying the new code.

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS booking_code text;
