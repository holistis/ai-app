import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, anamnesis, reports, payments, coachingSessions, patientProgress } from "../drizzle/schema";
import { ENV } from './_core/env';
import { eq, and } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── ANAMNESIS ────────────────────────────────────────────────────────────────

// Mappen van frontend conditionType naar wat in de DB enum staat
// Als de DB geen enum heeft maar varchar, werkt dit ook gewoon
const CONDITION_TYPE_MAP: Record<string, string> = {
  chronic_fatigue: "chronic_fatigue",
  digestive_issues: "digestive_issues",
  solk: "solk",
  auto_immuun: "auto_immuun",
  alk: "alk",
};

function normalizeConditionType(conditionType: string): string {
  return CONDITION_TYPE_MAP[conditionType] ?? conditionType;
}

export async function saveAnamnesis(
  userId: number,
  conditionType: string,
  responses: Record<string, any>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedCondition = normalizeConditionType(conditionType);
  const responsesJson =
    typeof responses === "string" ? responses : JSON.stringify(responses ?? {});

  console.log(`[DB] saveAnamnesis — userId: ${userId}, condition: ${normalizedCondition}, responses length: ${responsesJson.length}`);

  try {
    const result = await db.insert(anamnesis).values({
      userId,
      conditionType: normalizedCondition as any,
      responses: responsesJson,
      status: "submitted",
    });

    const insertedId = (result as any)[0]?.insertId ?? 1;
    console.log(`[DB] saveAnamnesis OK — insertedId: ${insertedId}`);
    return [{ id: insertedId }];
  } catch (error: any) {
    console.error(`[DB] saveAnamnesis FAILED:`, error?.message);
    console.error(`[DB] conditionType was: "${normalizedCondition}"`);
    console.error(`[DB] responses preview: ${responsesJson.substring(0, 200)}`);
    throw error;
  }
}

export async function getAnamnesisById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(anamnesis).where(eq(anamnesis.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserAnamnesis(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(anamnesis).where(eq(anamnesis.userId, userId));
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export async function saveReport(userId: number, anamnesisId: number, reportData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const serializeField = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "string") return val;
    return JSON.stringify(val);
  };

  return await db.insert(reports).values({
    userId,
    anamnesisId,
    reportType: reportData.reportType,
    title: reportData.title,
    content:
      typeof reportData.content === "string"
        ? reportData.content
        : JSON.stringify(reportData.content),
    summary: reportData.summary ?? null,
    keyInsights: serializeField(reportData.keyInsights),
    recommendations: serializeField(reportData.recommendations),
    protocols: serializeField(reportData.protocols),
    scientificReferences: serializeField(reportData.scientificReferences),
    status: "generated",
  });
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserReports(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userReports = await db
    .select()
    .from(reports)
    .where(eq(reports.userId, userId));

  const userPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "completed")));

  const paidReportIds = new Set(
    userPayments
      .filter((p: any) => p.reportId)
      .map((p: any) => p.reportId)
  );

  return userReports.map((report: any) => ({
    ...report,
    isPaid: paidReportIds.has(report.id),
  }));
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function savePayment(paymentData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(payments).values(paymentData);
}

export async function getPaymentByStripeId(stripePaymentIntentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserPayments(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(payments).where(eq(payments.userId, userId));
}

// ─── COACHING ─────────────────────────────────────────────────────────────────

export async function createCoachingSession(userId: number, reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(coachingSessions).values({
    userId,
    reportId,
    phase: "phase_1_awareness",
    messages: JSON.stringify([]),
    status: "active",
  });
}

export async function getCoachingSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(coachingSessions)
    .where(eq(coachingSessions.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserCoachingSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(coachingSessions)
    .where(eq(coachingSessions.userId, userId));
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

export async function recordProgress(
  userId: number,
  coachingSessionId: number,
  progressData: any
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(patientProgress).values({
    userId,
    coachingSessionId,
    ...progressData,
  });
}

export async function getSessionProgress(coachingSessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(patientProgress)
    .where(eq(patientProgress.coachingSessionId, coachingSessionId));
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

export async function getAllReports() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reports);
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(payments);
}

export async function getAllAnamnesis() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(anamnesis);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(users);
}

export async function updatePaymentStatus(paymentId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(payments)
    .set({ status: status as any })
    .where(eq(payments.id, paymentId));
}

export async function getUserByClerkId(clerkId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserFromClerk(
  clerkId: string,
  email: string,
  name: string
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const existing = await getUserByClerkId(clerkId);

    if (existing) {
      return await db
        .update(users)
        .set({ email, name, updatedAt: new Date() })
        .where(eq(users.clerkId, clerkId));
    }

    return await db.insert(users).values({
      clerkId,
      email,
      name,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user from Clerk:", error);
    throw error;
  }
}
