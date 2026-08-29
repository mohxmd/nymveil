CREATE TABLE `delivery_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_key` text NOT NULL,
	`user_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempted_at` integer NOT NULL,
	`completed_at` integer,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_id`) REFERENCES `destination`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_delivery_attempt_delivery_key` ON `delivery_attempt` (`delivery_key`);--> statement-breakpoint
CREATE INDEX `idx_delivery_attempt_user_id_created_at` ON `delivery_attempt` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_delivery_attempt_identity_id` ON `delivery_attempt` (`identity_id`);--> statement-breakpoint
CREATE INDEX `idx_delivery_attempt_destination_id` ON `delivery_attempt` (`destination_id`);--> statement-breakpoint
CREATE INDEX `idx_delivery_attempt_status` ON `delivery_attempt` (`status`);