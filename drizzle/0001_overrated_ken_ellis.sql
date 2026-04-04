CREATE TABLE `anamnesis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conditionType` enum('chronic_fatigue','digestive_issues','solk','alk','other') NOT NULL,
	`responses` json NOT NULL,
	`status` enum('draft','submitted','analyzed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anamnesis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coachingSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reportId` int NOT NULL,
	`phase` enum('phase_1_awareness','phase_2_foundation','phase_3_optimization','phase_4_integration','completed') NOT NULL DEFAULT 'phase_1_awareness',
	`messages` json,
	`currentFocus` varchar(255),
	`completedProtocols` json,
	`nextSteps` json,
	`progressNotes` text,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coachingSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patientProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachingSessionId` int NOT NULL,
	`date` timestamp NOT NULL DEFAULT (now()),
	`energyLevel` int,
	`sleepQuality` int,
	`digestiveHealth` int,
	`mentalClarity` int,
	`emotionalBalance` int,
	`notes` text,
	`protocolsCompleted` json,
	`challenges` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patientProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reportId` int,
	`stripePaymentIntentId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`paymentType` enum('foot_in_the_door','full_report','ai_coach_monthly') NOT NULL,
	`status` enum('pending','completed','failed','refunded','active','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`anamnesisId` int NOT NULL,
	`reportType` enum('foot_in_the_door','full_report') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`keyInsights` json,
	`recommendations` json,
	`protocols` json,
	`scientificReferences` json,
	`pdfUrl` varchar(255),
	`status` enum('draft','generated','sent') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);