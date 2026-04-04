import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { savePayment, getUserPayments, getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { reports, anamnesis } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendReportEmails } from "../_core/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const PRICES = {
  inzicht_rapport: 0.00, // Gratis
  full_report: 34.95,
};

export const paymentsRouter = router({
  createCheckout: protectedProcedure
    .input(z.object({
      reportId: z.number().optional(),
      paymentType: z.enum(["inzicht_rapport", "full_report"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Create Stripe customer if not exists
        let stripeCustomerId = ctx.user.stripeCustomerId;
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email || undefined,
            name: ctx.user.name || undefined,
            metadata: {
              userId: ctx.user.id.toString(),
            },
          });
          stripeCustomerId = customer.id;
          // In production, update user with stripeCustomerId
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: getPriceLabel(input.paymentType),
                  description: getPriceDescription(input.paymentType),
                },
                unit_amount: Math.round((PRICES[input.paymentType] || 0) * 100),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${ctx.req.headers.origin}/rapport?success=true`,
          cancel_url: `${ctx.req.headers.origin}/rapport?cancelled=true`,
          metadata: {
            userId: ctx.user.id.toString(),
            reportId: input.reportId?.toString() || "",
            paymentType: input.paymentType,
          },
        });

        // Save payment record
        await savePayment({
          userId: ctx.user.id,
          reportId: input.reportId,
          stripePaymentIntentId: session.payment_intent?.toString() || session.id,
          amount: PRICES[input.paymentType] || 0,
          currency: "EUR",
          paymentType: input.paymentType,
          status: "pending",
        });

        // Notify owner about new payment attempt
        try {
          await notifyOwner({
            title: `💳 Nieuwe betaling gestart: ${getPriceLabel(input.paymentType)}`,
            content: `👤 Klant: ${ctx.user.name || "Onbekend"} (${ctx.user.email || "geen email"})
💰 Bedrag: €${PRICES[input.paymentType]?.toFixed(2)}
📌 Type: ${getPriceLabel(input.paymentType)}
📅 Datum: ${new Date().toLocaleString("nl-NL")}

⚠️ Betaling nog NIET bevestigd — wacht op Stripe webhook.
🔗 Admin: ${ctx.req.headers.origin || "https://ai.holistischadviseur.nl"}/admin`,
          });
        } catch (notifError) {
          console.warn("[Notify] Failed to notify owner about payment:", notifError);
        }

        return {
          checkoutUrl: session.url,
          sessionId: session.id,
        };
      } catch (error) {
        console.error("Stripe checkout error:", error);
        throw error;
      }
    }),

  getPayments: protectedProcedure
    .query(async ({ ctx }) => {
      return await getUserPayments(ctx.user.id);
    }),

  // TEST ENDPOINT: Simulate successful payment for development
  // Usage: POST /api/trpc/payments.testPayment with { reportId: number, paymentType: "full_report" }
  testPayment: protectedProcedure
    .input(z.object({
      reportId: z.number(),
      paymentType: z.enum(["inzicht_rapport", "full_report"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "development") {
        throw new Error("Test payment endpoint only available in development mode");
      }

      console.log(`[TEST] Simulating payment for user ${ctx.user.id}, report ${input.reportId}`);

      // Save payment record with "completed" status
      const payment = await savePayment({
        userId: ctx.user.id,
        reportId: input.reportId,
        stripePaymentIntentId: `test_${Date.now()}`,
        amount: PRICES[input.paymentType] || 0,
        currency: "EUR",
        paymentType: input.paymentType,
        status: "completed",
      });

      console.log(`[TEST] Payment saved with status: completed`);

      // Trigger full report generation
      if (input.paymentType === "full_report") {
        console.log(`[TEST] Triggering full report generation for report ${input.reportId}`);
        
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          // Get the report
          const report = await db
            .select()
            .from(reports)
            .where(eq(reports.id, input.reportId))
            .limit(1) as any;

          if (!report.length) {
            throw new Error("Report not found");
          }

          // Get anamnesis data
          const anamnesisData = await db
            .select()
            .from(anamnesis)
            .where(eq(anamnesis.id, report[0].anamnesisId))
            .limit(1) as any;

          if (!anamnesisData.length) {
            throw new Error("Anamnesis data not found");
          }

          const anamnesisResponses = (anamnesisData[0]?.responses || {}) as Record<string, any>;

          // For now, we'll use a simpler approach - just mark report as generated
          // The actual full report generation would be triggered by webhook in production
          console.log(`[TEST] Marking report as generated (full generation would happen via webhook in production)`);

          // Update report in database to mark as generated
          await db
            .update(reports)
            .set({
              status: "generated",
            })
            .where(eq(reports.id, input.reportId));

          console.log(`[TEST] Report marked as generated - payment recorded`);

          // In production, emails would be sent after full report generation
          console.log(`[TEST] Test payment complete`);

          return {
            success: true,
            message: "Test payment processed successfully",
            paymentId: (payment as any).insertId,
          };
        } catch (error) {
          console.error(`[TEST] Payment processing failed:`, error);
          throw error;
        }
      }

      return {
        success: true,
        message: "Test payment processed",
        paymentId: (payment as any).insertId,
      };
    }),
});

function getPriceLabel(type: string): string {
  switch (type) {
    case "inzicht_rapport":
      return "Inzicht Rapport";
    case "full_report":
      return "Volledig Gezondheidsrapport";

    default:
      return "Betaling";
  }
}

function getPriceDescription(type: string): string {
  switch (type) {
    case "inzicht_rapport":
      return "Eerste inzichten in je gezondheid (20% preview)";
    case "full_report":
      return "Volledig rapport met protocollen en aanbevelingen (1 jaar advies)";

    default:
      return "";
  }
}
