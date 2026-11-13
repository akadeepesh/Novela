import { beforeEach, describe, expect, it } from "vitest"
import { db } from "./db"
import * as P from "./projects"
import * as C from "./chapters"
import { dayBefore, goalProgress, listWritingLog, localDay, logWords } from "./goals"

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })

beforeEach(async () => {
  await Promise.all([db().projects.clear(), db().chapters.clear(), db().versions.clear(), db().writingLog.clear()])
})

describe("goalProgress", () => {
  const log = [
    { date: "2026-11-01", words: 600 },
    { date: "2026-11-02", words: 500 },
    { date: "2026-11-03", words: 520 },
    { date: "2026-11-05", words: 900 },
    { date: "2026-11-06", words: 100 },
    { date: "2026-11-07", words: 700 },
    { date: "2026-11-08", words: 800 },
  ]

  it("counts the current streak ending today", () => {
    const p = goalProgress(log, 500, "2026-11-08")
    expect(p.today).toBe(800)
    expect(p.streak).toBe(2)
    expect(p.best).toBe(3)
  })

  it("keeps yesterday's streak alive while today isn't done yet", () => {
    expect(goalProgress([...log, { date: "2026-11-09", words: 50 }], 500, "2026-11-09").streak).toBe(2)
  })

  it("breaks after a missed day", () => {
    expect(goalProgress(log, 500, "2026-11-10").streak).toBe(0)
  })

  it("lists the last days oldest first, with gaps as zero", () => {
    const p = goalProgress(log, 500, "2026-11-08", 5)
    expect(p.recent).toEqual([
      { date: "2026-11-04", words: 0 },
      { date: "2026-11-05", words: 900 },
      { date: "2026-11-06", words: 100 },
      { date: "2026-11-07", words: 700 },
      { date: "2026-11-08", words: 800 },
    ])
  })

  it("steps over month and year ends", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28")
    expect(dayBefore("2027-01-01")).toBe("2026-12-31")
  })
})

describe("writing log", () => {
  it("adds words gained by saves, never subtracting", async () => {
    const pid = await P.createProject({ title: "Log", type: "novel" })
    const c = await C.createChapter(pid, { content: doc("one two three") }, "Chapter")
    if (!c.ok) throw new Error("create failed")
    await C.saveChapter(pid, c.id, { content: doc("one two three four five") })
    await C.saveChapter(pid, c.id, { content: doc("one") })
    await C.saveChapter(pid, c.id, { content: doc("one six seven") })
    const log = await listWritingLog(pid)
    expect(log).toEqual([expect.objectContaining({ date: localDay(), words: 3 + 2 + 2 })])
  })

  it("keeps one record per book per day", async () => {
    await logWords("p1", 10, "2026-11-01")
    await logWords("p1", 15, "2026-11-01")
    await logWords("p1", 5, "2026-11-02")
    await logWords("p2", 7, "2026-11-01")
    await logWords("p1", -20, "2026-11-01")
    const p1 = (await listWritingLog("p1")).sort((a, b) => a.date.localeCompare(b.date))
    expect(p1.map((r) => [r.date, r.words])).toEqual([["2026-11-01", 25], ["2026-11-02", 5]])
  })

  it("is removed with its book", async () => {
    const pid = await P.createProject({ title: "Gone", type: "novel" })
    await logWords(pid, 100)
    await P.trashProject(pid)
    await P.deleteProjectForever(pid)
    expect(await listWritingLog(pid)).toEqual([])
  })
})
