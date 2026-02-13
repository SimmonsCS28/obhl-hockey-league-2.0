-- Migration: Add phone_number to users table
-- Description: Standardizes phone number storage for all users
-- Date: 2026-02-12

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add comment
COMMENT ON COLUMN users.phone_number IS 'User contact phone number';
