import "server-only";
import { connectDB } from "@/lib/db";
import { RateLimit } from "@/lib/models/rate-limit";

/**
 * Counts one attempt for `key` in the current fixed window and says whether
 * it is within `max`. Used to keep public forms (reader comments, share-link
 * passwords) from being flooded or brute-forced.
 */
export async function withinRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  await connectDB();
  const bucket = Math.floor(Date.now() / windowMs);
  const doc = await RateLimit.findOneAndUpdate(
    { key: `${key}:${bucket}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } },
    { upsert: true, new: true }
  ).lean<{ count: number }>();
  return (doc?.count ?? 1) <= max;
}
