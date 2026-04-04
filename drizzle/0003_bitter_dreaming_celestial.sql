ALTER TABLE `anamnesis` MODIFY COLUMN `responses` text NOT NULL;--> statement-breakpoint
ALTER TABLE `coachingSessions` MODIFY COLUMN `messages` text;--> statement-breakpoint
ALTER TABLE `coachingSessions` MODIFY COLUMN `completedProtocols` text;--> statement-breakpoint
ALTER TABLE `coachingSessions` MODIFY COLUMN `nextSteps` text;--> statement-breakpoint
ALTER TABLE `patientProgress` MODIFY COLUMN `protocolsCompleted` text;--> statement-breakpoint
ALTER TABLE `reports` MODIFY COLUMN `keyInsights` text;--> statement-breakpoint
ALTER TABLE `reports` MODIFY COLUMN `recommendations` text;--> statement-breakpoint
ALTER TABLE `reports` MODIFY COLUMN `protocols` text;--> statement-breakpoint
ALTER TABLE `reports` MODIFY COLUMN `scientificReferences` text;