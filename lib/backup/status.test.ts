import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/store/db"
import { createProject } from "@/lib/store/projects"
import { getBackupStatus, recordBackup, snoozeReminder } from "./status"

const DAY = 24 * 60 * 60 * 1000

beforeEach(async () => {
  await Promise.all([db().projects.clear(), db().meta.clear()])
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
})
afterEach(() => vi.useRealTimers())

describe("backup reminder", () => {
  it("stays quiet with nothing to protect", async () => {
    vi.setSystemTime(Date.now() + 30 * DAY)
    expect((await getBackupStatus()).reminderDue).toBe(false)
  })

  it("waits a week after the first book before nagging someone who never backed up", async () => {
    await createProject({ title: "A", type: "novel" })
    vi.setSystemTime(Date.now() + 6 * DAY)
    expect((await getBackupStatus()).reminderDue).toBe(false)
    vi.setSystemTime(Date.now() + 1 * DAY)
    expect((await getBackupStatus()).reminderDue).toBe(true)
  })

  it("counts from the last backup, and can be snoozed", async () => {
    await createProject({ title: "A", type: "novel" })
    vi.setSystemTime(Date.now() + 10 * DAY)
    await recordBackup("download")
    const status = await getBackupStatus()
    expect(status.reminderDue).toBe(false)
    expect(status.lastBackupVia).toBe("download")

    vi.setSystemTime(Date.now() + 8 * DAY)
    expect((await getBackupStatus()).reminderDue).toBe(true)
    await snoozeReminder()
    expect((await getBackupStatus()).reminderDue).toBe(false)
    vi.setSystemTime(Date.now() + 4 * DAY)
    expect((await getBackupStatus()).reminderDue).toBe(true)
  })
})
