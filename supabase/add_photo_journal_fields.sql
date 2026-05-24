-- Migration: Add journal support to photos table
-- Run this on Supabase SQL Editor after deploying the new code.

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'photo';
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS content text;
