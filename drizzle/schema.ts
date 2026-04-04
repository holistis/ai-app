import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).unique(),
  /** Clerk authentication identifier. Unique per user. */
  clerkId: varchar("clerkId", { length: 255 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Anamnesis table: Stores patient questionnaire responses
 */
export const anamnesis = mysqlTable("anamnesis", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conditionType: mysqlEnum("conditionType", [
    "chronic_fatigue",
    "digestive_issues",
    "solk",
    "alk",
    "other"
  ]).notNull(),
  responses: text("responses").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "analyzed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Anamnesis = typeof anamnesis.$inferSelect;
export type InsertAnamnesis = typeof anamnesis.$inferInsert;

/**
 * Reports table: Stores generated reports
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  anamnesisId: int("anamnesisId").notNull(),
  reportType: mysqlEnum("reportType", ["inzicht_rapport", "foot_in_the_door", "full_report"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  keyInsights: text("keyInsights"),
  recommendations: text("recommendations"),
  protocols: text("protocols"),
  scientificReferences: text("scientificReferences"),
  pdfUrl: varchar("pdfUrl", { length: 255 }),
  status: mysqlEnum("status", ["draft", "generated", "sent"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Payments table: Tracks all payments and subscriptions
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reportId: int("reportId"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
  paymentType: mysqlEnum("paymentType", [
    "inzicht_rapport",
    "full_report",
    "ai_coach_monthly"
  ]).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "completed",
    "failed",
    "refunded",
    "active",
    "cancelled"
  ]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Coaching sessions table: Tracks AI coaching sessions
 */
export const coachingSessions = mysqlTable("coachingSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reportId: int("reportId").notNull(),
  phase: varchar("phase", { length: 64 }).notNull(),
  messages: text("messages").notNull(),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoachingSession = typeof coachingSessions.$inferSelect;
export type InsertCoachingSession = typeof coachingSessions.$inferInsert;

/**
 * Patient progress table: Tracks patient progress during coaching
 */
export const patientProgress = mysqlTable("patientProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  coachingSessionId: int("coachingSessionId").notNull(),
  weekNumber: int("weekNumber").notNull(),
  adherenceScore: decimal("adherenceScore", { precision: 3, scale: 2 }),
  symptomScore: decimal("symptomScore", { precision: 3, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientProgress = typeof patientProgress.$inferSelect;
export type InsertPatientProgress = typeof patientProgress.$inferInsert;
