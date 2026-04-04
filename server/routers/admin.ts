import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllReports, getAllPayments, getAllAnamnesis, getAllUsers } from "../db";
import { TRPCError } from "@trpc/server";

// Admin middleware - only allow admin users
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if ((ctx.user as any).role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Get all reports with user info
  getAllReports: adminProcedure.query(async () => {
    return await getAllReports();
  }),

  // Get all payments
  getAllPayments: adminProcedure.query(async () => {
    return await getAllPayments();
  }),

  // Get all anamnesis submissions
  getAllAnamnesis: adminProcedure.query(async () => {
    return await getAllAnamnesis();
  }),

  // Get all users
  getAllUsers: adminProcedure.query(async () => {
    return await getAllUsers();
  }),

  // Get dashboard stats
  getStats: adminProcedure.query(async () => {
    const [reports, payments, anamnesisData, users] = await Promise.all([
      getAllReports(),
      getAllPayments(),
      getAllAnamnesis(),
      getAllUsers(),
    ]);

    const totalRevenue = payments
      .filter((p: any) => p.status === "completed" || p.status === "paid")
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    const fullReports = reports.filter((r: any) => r.reportType === "full_report").length;
    const inzichtRapporten = reports.filter((r: any) => r.reportType === "inzicht_rapport").length;

    return {
      totalUsers: users.length,
      totalReports: reports.length,
      fullReports,
      inzichtRapporten,
      totalAnamnesis: anamnesisData.length,
      totalPayments: payments.length,
      totalRevenue: totalRevenue.toFixed(2),
      pendingPayments: payments.filter((p: any) => p.status === "pending").length,
    };
  }),
});
