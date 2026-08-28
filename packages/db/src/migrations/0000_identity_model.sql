CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_account_issuer_account_id` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_account_user_id` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `destination` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`config_ref` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_destination_user_id` ON `destination` (`user_id`);--> statement-breakpoint
CREATE TABLE `domain` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hostname` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verification_token_hash` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_domain_hostname` ON `domain` (`hostname`);--> statement-breakpoint
CREATE INDEX `idx_domain_user_id` ON `domain` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_domain_status` ON `domain` (`status`);--> statement-breakpoint
CREATE TABLE `identity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`local_part` text NOT NULL,
	`address` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`torched_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `domain`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_identity_address` ON `identity` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_identity_domain_id_local_part` ON `identity` (`domain_id`,`local_part`);--> statement-breakpoint
CREATE INDEX `idx_identity_user_id` ON `identity` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_identity_domain_id` ON `identity` (`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_identity_status_expires_at` ON `identity` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `identity_destination` (
	`identity_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsecond') * 1000) NOT NULL,
	PRIMARY KEY(`identity_id`, `destination_id`),
	FOREIGN KEY (`identity_id`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_id`) REFERENCES `destination`(`id`) ON UPDATE no action ON DELETE cascade
);
