-- Add AI support to users table
ALTER TABLE `users` ADD COLUMN `is_ai` integer DEFAULT 0 NOT NULL;
ALTER TABLE `users` ADD COLUMN `ai_difficulty` text; 