ALTER TABLE `destination` RENAME COLUMN "config_ref" TO "target_ref";--> statement-breakpoint
ALTER TABLE `destination` ALTER COLUMN "target_ref" TO "target_ref" text;--> statement-breakpoint
