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
ALTER TABLE `users` ADD `coin_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `selected_board_theme` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `selected_pawn_theme` text DEFAULT 'default' NOT NULL;