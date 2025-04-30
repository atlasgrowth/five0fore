-- Migration to add progress tracking columns to order_items table
-- This migration adds columns for tracking item progress and readiness

-- Add progress_percent column to store progress percentage (0-100)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS progress_percent INTEGER;

-- Add is_ready_for_next_step column to indicate if an item is ready to move to the next step
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_ready_for_next_step BOOLEAN DEFAULT FALSE;