import "server-only";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { DailyStat } from "@/lib/models/daily-stat";
import { requireUserId } from "@/lib/projects";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Called after a chapter's content is saved. Records today's running
 * total word count for the project, and derives "words written today" as
 * the increase over the most recent prior day's total — so it reflects
 * net progress (additions minus cuts), floored at zero.
 */
export async function recordDailyProgress(userId: string, projectId: string): Promise<void> {
  await connectDB();

  const chapters = await Chapter.find({ projectId, ownerId: userId })
    .select("wordCount")
    .lean<{ wordCount?: number }[]>();
  const totalWordCount = chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);

  const today = todayUTC();

  const previous = await DailyStat.findOne({ projectId, ownerId: userId, date: { $lt: today } })
    .sort({ date: -1 })
    .lean<{ totalWordCount?: number }>();
  const previousTotal = previous?.totalWordCount ?? 0;
  const wordsWritten = Math.max(0, totalWordCount - previousTotal);

  await DailyStat.updateOne(
    { projectId, ownerId: userId, date: today },
    { $set: { totalWordCount, wordsWritten } },
    { upsert: true }
  );
}

export type ProjectProgress = {
  totalWordCount: number;
  targetWordCount?: number;
  dailyGoal: number;
  todayWordsWritten: number;
  streakDays: number;
  last14Days: { date: string; wordsWritten: number }[];
};

export async function getProjectProgress(
  projectId: string,
  targetWordCount: number | undefined,
  dailyGoal: number
): Promise<ProjectProgress> {
  const userId = await requireUserId();
  await connectDB();

  const today = todayUTC();
  const since = shiftDate(today, -60); // enough history to compute a long streak

  const stats = await DailyStat.find({ projectId, ownerId: userId, date: { $gte: since } })
    .sort({ date: 1 })
    .lean<{ date: string; wordsWritten: number; totalWordCount: number }[]>();

  const byDate = new Map(stats.map((s) => [s.date, s]));
  const totalWordCount = stats.at(-1)?.totalWordCount ?? 0;
  const todayWordsWritten = byDate.get(today)?.wordsWritten ?? 0;

  // Streak: consecutive days with wordsWritten > 0, walking back from
  // today. If nothing's been written yet today, that's not a broken
  // streak on its own — start counting from yesterday instead.
  let streakDays = 0;
  let cursor = byDate.get(today) && byDate.get(today)!.wordsWritten > 0 ? today : shiftDate(today, -1);
  while (true) {
    const entry = byDate.get(cursor);
    if (!entry || entry.wordsWritten <= 0) break;
    streakDays++;
    cursor = shiftDate(cursor, -1);
  }

  const last14Days: { date: string; wordsWritten: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = shiftDate(today, -i);
    last14Days.push({ date, wordsWritten: byDate.get(date)?.wordsWritten ?? 0 });
  }

  return { totalWordCount, targetWordCount, dailyGoal, todayWordsWritten, streakDays, last14Days };
}
