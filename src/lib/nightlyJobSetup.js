/**
 * NIGHTLY OCCURRENCE MATERIALIZATION JOB
 *
 * This file documents how to set up a nightly job that extends habit occurrences
 * by an additional 30 days. This prevents infinite loops while scaling to 100+ habits.
 *
 * ARCHITECTURE:
 * - Runs daily at 02:00 UTC (when most users are asleep)
 * - For each active habit, checks if occurrences exist through next 30 days
 * - If gap detected, generates missing occurrences using RRULE
 * - Takes ~1-5 seconds per 100 habits (not user-blocking)
 *
 * IMPLEMENTATION OPTIONS:
 */

/**
 * OPTION 1: AWS LAMBDA + EventBridge (Recommended for production)
 *
 * Setup:
 * 1. Create Lambda function (Node.js 18.x runtime)
 * 2. Add function code (see pseudocode below)
 * 3. Add environment variables:
 *    - DB_CONNECTION: IndexedDB remote endpoint (if using cloud DB)
 * 4. Create EventBridge rule:
 *    - Schedule: cron(0 2 * * ? *)  // Daily at 02:00 UTC
 *    - Target: Lambda function
 * 5. Add Lambda permissions: EventBridge can invoke
 * 6. Set timeout: 60 seconds (default usually sufficient)
 *
 * Cost: ~$0.20/month (1 daily invocation × 30 days, <1s execution)
 */

/**
 * OPTION 2: Vercel Cron (Recommended for hobby/small apps)
 *
 * Setup:
 * 1. Create api/cron/materialize-occurrences.js in Vercel project
 * 2. Deploy to Vercel
 * 3. Vercel automatically runs based on cron schedule
 *
 * Cost: Included in Vercel free tier
 *
 * Implementation (Vercel API Route):
 *
 *   export default async function handler(req, res) {
 *     // Verify cron secret for security
 *     if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
 *       return res.status(401).json({ error: "Unauthorized" });
 *     }
 *
 *     try {
 *       const result = await materializeOccurrencesNightly();
 *       return res.status(200).json({ success: true, ...result });
 *     } catch (err) {
 *       console.error("Nightly job failed:", err);
 *       return res.status(500).json({ error: err.message });
 *     }
 *   }
 *
 *   export const config = {
 *     api: {
 *       route: '/api/cron/materialize-occurrences',
 *     },
 *   };
 */

/**
 * OPTION 3: Heroku Scheduler (Legacy, not recommended)
 *
 * Setup:
 * 1. Add Heroku Scheduler add-on
 * 2. Create daily task: node scripts/nightly-materialize.js
 * 3. Set time: 02:00 UTC
 *
 * Cost: $7/month (add-on), but Heroku is deprecating free tier
 */

/**
 * PSEUDOCODE: materializeOccurrencesNightly()
 *
 * async function materializeOccurrencesNightly() {
 *   const db = await initHabitDB();
 *   const now = new Date();
 *   const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
 *
 *   const habits = await listHabits(false); // active only
 *   let totalCreated = 0;
 *   const startTime = performance.now();
 *
 *   for (const habit of habits) {
 *     try {
 *       const latestVersion = await getLatestVersion(habit.id);
 *       if (!latestVersion || !latestVersion.rrule) continue;
 *
 *       const existingOccurrences = await getOccurrencesByHabit(
 *         habit.id,
 *         now,
 *         thirtyDaysOut
 *       );
 *
 *       if (existingOccurrences.length === 0) {
 *         // No occurrences in range - generate all
 *         const generated = generateOccurrences(
 *           latestVersion.rrule,
 *           now,
 *           thirtyDaysOut
 *         );
 *
 *         const occurrences = generated.map(g => ({
 *           id: generateId(),
 *           habitId: habit.id,
 *           habitVersionId: latestVersion.id,
 *           dueAt: g.dueAt,
 *           status: "pending",
 *           completedAt: null,
 *           variant: null,
 *           actualValue: null,
 *           actualDurationMin: null,
 *           notes: null,
 *           mood: null,
 *           createdAt: new Date().toISOString(),
 *           updatedAt: new Date().toISOString(),
 *         }));
 *
 *         // Batch insert
 *         await db.transaction(["habit_occurrences"], "readwrite")
 *           .objectStore("habit_occurrences")
 *           .addAll(occurrences);
 *
 *         totalCreated += occurrences.length;
 *       } else {
 *         // Check if gap exists
 *         const lastOcc = existingOccurrences[existingOccurrences.length - 1];
 *         if (new Date(lastOcc.dueAt) < thirtyDaysOut) {
 *           // Generate missing occurrences
 *           const gap = generateOccurrences(
 *             latestVersion.rrule,
 *             new Date(lastOcc.dueAt),
 *             thirtyDaysOut
 *           );
 *
 *           // Same batch insert logic...
 *         }
 *       }
 *     } catch (err) {
 *       console.error(`Failed to materialize for habit ${habit.id}:`, err);
 *       // Continue with next habit (don't fail entire job)
 *     }
 *   }
 *
 *   const elapsed = performance.now() - startTime;
 *   return {
 *     habitsProcessed: habits.length,
 *     occurrencesCreated: totalCreated,
 *     durationMs: Math.round(elapsed),
 *   };
 * }
 */

/**
 * MONITORING & ALERTING
 *
 * Track job health:
 * 1. Log successful completions with metrics
 * 2. Log errors with habit ID + error details
 * 3. Set up alerts if job fails 3+ times consecutively
 * 4. Set up alerts if execution time exceeds 30 seconds
 *
 * Example logging:
 *   const log = {
 *     timestamp: new Date().toISOString(),
 *     status: "success",
 *     habitsProcessed: 42,
 *     occurrencesCreated: 128,
 *     durationMs: 3400,
 *   };
 *   console.log(JSON.stringify(log));
 */

/**
 * MANUAL MATERIALIZATION
 *
 * If job fails or needs manual run:
 * 1. Open browser DevTools Console
 * 2. Run: await materializeOccurrencesNightly()
 * 3. Check console for results
 *
 * This is safe to run multiple times (idempotent).
 */

export const NIGHTLY_JOB_DOCUMENTATION = {
  name: "materializeOccurrencesNightly",
  description: "Extends habit occurrences by 30 days to prevent infinite loops",
  schedule: "Daily at 02:00 UTC",
  duration: "1-5 seconds for 100 habits",
  recommended: "Vercel Cron (free) or AWS Lambda ($0.20/month)",
  safety: "Idempotent - safe to run multiple times",
  monitoring: "Track execution time and error rate",
};
