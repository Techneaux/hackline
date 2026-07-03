CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`domain` text NOT NULL,
	`label` text NOT NULL,
	`identity` text,
	`auth_json` text,
	`color` text DEFAULT '#3DDC97' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`calendar_id` text,
	`title` text DEFAULT '' NOT NULL,
	`description` text,
	`location` text,
	`start_ts` text NOT NULL,
	`end_ts` text NOT NULL,
	`all_day` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`attendees_json` text,
	`raw_json` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_account_external` ON `calendar_events` (`account_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `events_start` ON `calendar_events` (`start_ts`);--> statement-breakpoint
CREATE TABLE `habit_scores` (
	`date` text NOT NULL,
	`habit` text NOT NULL,
	`score` integer NOT NULL,
	PRIMARY KEY(`date`, `habit`)
);
--> statement-breakpoint
CREATE TABLE `planner_days` (
	`date` text PRIMARY KEY NOT NULL,
	`message_to_self` text,
	`morning_json` text,
	`top3_json` text,
	`schedule_notes_json` text,
	`must_do_json` text,
	`connect_json` text,
	`notes` text,
	`evening_json` text,
	`tomorrow_planned` integer DEFAULT 0 NOT NULL,
	`morning_completed_at` text,
	`evening_completed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`account_id` integer NOT NULL,
	`resource` text NOT NULL,
	`cursor` text,
	`last_synced_at` text,
	`last_error` text,
	PRIMARY KEY(`account_id`, `resource`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`content` text NOT NULL,
	`description` text,
	`due_date` text,
	`due_datetime` text,
	`priority` integer DEFAULT 1 NOT NULL,
	`project_id` text,
	`project_name` text,
	`section_id` text,
	`section_name` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_source_external` ON `tasks` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `tasks_due` ON `tasks` (`due_date`);