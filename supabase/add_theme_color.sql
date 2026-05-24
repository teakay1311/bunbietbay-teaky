-- Migration: Add theme_color column to trips table
-- Run this in Supabase SQL Editor

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS theme_color text;
