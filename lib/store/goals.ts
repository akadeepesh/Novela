import { db, newId, type WritingLogRecord } from "./db"

/**
 * Daily word goals and streaks. Each save adds the words gained since the
 * previous save to today's total; deleting or rewriting text never takes
 * anything away, so editing doesn't cost a writer their progress.
 */

/** A local calendar day as "YYYY-MM-DD". */
export function localDay(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** The day `n` days before `day` ("YYYY-MM-DD"), in local time. */
export function dayBefore(day: string, n = 1): string {
  const [y, m, d] = day.split("-").map(Number)
  return localDay(new Date(y, m - 1, d - n))
}

/** Adds words to a book's total for `day` (today by default). */
export async function logWords(projectId: string, words: number, day = localDay()): Promise<void> {
  if (!(words > 0)) return
  const d = db()
  await d.transaction("rw", d.writingLog, async () => {
    const existing = await d.writingLog.where("[projectId+date]").equals([projectId, day]).first()
    if (existing) await d.writingLog.put({ ...existing, words: existing.words + Math.round(words) })
    else await d.writingLog.add({ id: newId(), projectId, date: day, words: Math.round(words) })
  })
}

export async function listWritingLog(projectId: string): Promise<WritingLogRecord[]> {
  return db().writingLog.where("projectId").equals(projectId).toArray()
}

export type GoalProgress = {
  goal: number
  today: number
  /** Days in a row the goal was met, ending today (or yesterday, if today isn't done yet). */
  streak: number
  best: number
  /** Words per day for the last `days` days, oldest first. */
  recent: { date: string; words: number }[]
}

/** Streaks and recent days from a book's writing log. Pure, for testing. */
export function goalProgress(log: { date: string; words: number }[], goal: number, today = localDay(), days = 30): GoalProgress {
  const byDay = new Map(log.map((r) => [r.date, r.words]))
  const met = (day: string) => goal > 0 && (byDay.get(day) ?? 0) >= goal

  let streak = 0
  let day = met(today) ? today : dayBefore(today)
  while (met(day)) {
    streak++
    day = dayBefore(day)
  }

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const date of [...byDay.keys()].filter(met).sort()) {
    run = prev && dayBefore(date) === prev ? run + 1 : 1
    best = Math.max(best, run)
    prev = date
  }

  const recent = Array.from({ length: days }, (_, i) => {
    const date = dayBefore(today, days - 1 - i)
    return { date, words: byDay.get(date) ?? 0 }
  })
  return { goal, today: byDay.get(today) ?? 0, streak, best: Math.max(best, streak), recent }
}

/** A book's goal progress, for live queries. */
export async function getGoalProgress(projectId: string): Promise<GoalProgress | null> {
  const project = await db().projects.get(projectId)
  if (!project || project.deletedAt) return null
  return goalProgress(await listWritingLog(projectId), project.dailyWordGoal ?? 300)
}

/** Largest daily goal accepted. */
export const MAX_DAILY_GOAL = 20_000

/** Sets a book's daily word goal. 0 turns goals off. Bookkeeping, so `updatedAt` stays put. */
export async function setDailyWordGoal(projectId: string, goal: number): Promise<boolean> {
  const words = Math.min(MAX_DAILY_GOAL, Math.max(0, Math.round(goal) || 0))
  return db().transaction("rw", db().projects, async () => {
    const r = await db().projects.get(projectId)
    if (!r || r.deletedAt) return false
    await db().projects.put({ ...r, dailyWordGoal: words })
    return true
  })
}
