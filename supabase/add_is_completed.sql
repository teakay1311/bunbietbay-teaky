-- Script To Add Missing is_completed column
-- Run this in your Supabase SQL Editor or apply via Supabase CLI

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS is_completed boolean not null default false;
