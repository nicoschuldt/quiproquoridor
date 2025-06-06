CREATE TABLE `game_players` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`player_index` integer NOT NULL,
	`color` text NOT NULL,
	`final_position` text,
	`walls_used` integer DEFAULT 0 NOT NULL,
	`is_winner` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`game_state` text NOT NULL,
	`status` text DEFAULT 'playing' NOT NULL,
	`winner_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text(6) NOT NULL,
	`host_id` text NOT NULL,
	`max_players` integer NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`has_time_limit` integer DEFAULT false NOT NULL,
	`time_limit_seconds` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE TABLE `shop_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`price_coins` integer NOT NULL,
	`css_class` text NOT NULL,
	`preview_image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`shop_item_id` text,
	`stripe_session_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shop_item_id`) REFERENCES `shop_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shop_item_id` text NOT NULL,
	`purchased_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shop_item_id`) REFERENCES `shop_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_purchases_user_id_shop_item_id_unique` ON `user_purchases` (`user_id`,`shop_item_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text(50) NOT NULL,
	`password_hash` text(255) NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`games_won` integer DEFAULT 0 NOT NULL,
	`coin_balance` integer DEFAULT 0 NOT NULL,
	`selected_board_theme` text DEFAULT 'theme-board-default' NOT NULL,
	`selected_pawn_theme` text DEFAULT 'theme-pawn-default' NOT NULL,
	`is_ai` integer DEFAULT false NOT NULL,
	`ai_difficulty` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);