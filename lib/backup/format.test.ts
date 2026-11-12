import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/lib/store/db"
import * as P from "@/lib/store/projects"
import * as C from "@/lib/store/chapters"
import * as V from "@/lib/store/versions"
import * as B from "@/lib/store/bible"
import * as N from "@/lib/store/notes"
import * as CM from "@/lib/store/comments"
import * as A from "@/lib/store/assets"
import { listChaptersMentioning } from "@/lib/store/mentions"
import { BackupError, createBackup, findConflicts, importBackup, readBackup } from "./format"

const TABLES = [
  "projects",
  "chapters",
  "versions",
  "characters",
  "worldEntries",
  "plotThreads",
  "notes",
  "researchEntries",
  "comments",
  "assets",
  "meta",
] as const

async function clearAll() {
  const d = db()
  await Promise.all(TABLES.map((t) => d[t].clear()))
}

/** Every record of every table (images as their bytes), sorted for comparison. */
async function snapshot() {
  const d = db()
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES.filter((t) => t !== "meta" && t !== "assets")) {
    out[t] = ((await d[t].toArray()) as { id: string }[]).sort((a, b) => a.id.localeCompare(b.id))
  }
  const assets = await d.assets.toArray()
  out.assets = await Promise.all(
    assets
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(async ({ blob, ...rest }) => ({ ...rest, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) }))
  )
  return out
}

/** A small but complete book: chapters, history, a trashed chapter, bible, notes, comments, a cover. */
async function seedBook(title = "The Glass Tower") {
  const pid = await P.createProject({ title, type: "novel" })
  const mara = await B.createCharacter(pid, {
    name: "Mara", role: "protagonist", aliases: ["M"], imageUrl: "", appearance: "green eyes",
    personality: "", backstory: "", notes: "",
  })
  await B.createWorldEntry(pid, { name: "Tower", type: "location", aliases: [], imageUrl: "", description: "tall", notes: "" })
  await B.createPlotThread(pid, { title: "The heist", status: "active", aliases: [], description: "", notes: "" })
  const c1 = await C.createChapter(pid, {
    content: {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: mara, entityType: "character", label: "Mara" } },
          { type: "text", text: " climbed.", marks: [{ type: "comment", attrs: { commentId: "placeholder" } }] },
        ],
      }],
    },
  }, "Chapter")
  const c2 = await C.createChapter(pid, { title: "Cut scene" }, "Chapter")
  if (!c1.ok || !c2.ok) throw new Error("seed failed")
  await C.saveChapter(pid, c1.id, { title: "Up" })
  await V.createManualSnapshot(pid, c1.id, "first draft")
  await C.trashChapter(pid, c2.id)
  await CM.createComment(pid, c1.id, { body: "tighten", quote: "climbed" })
  await N.createNote(pid, { title: "Idea", content: "a second tower" })
  await N.createResearchEntry(pid, { title: "Glass", type: "note", content: "how glass is made" })
  const img = await A.saveImage(pid, new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: "image/png" }))
  if (img.ok) await P.updateProject(pid, { coverFrontUrl: img.ref })
  return { pid, mara: mara!, chapterId: c1.id }
}

beforeEach(clearAll)

describe("backups", () => {
  it("restores a full backup exactly after the browser is cleared", async () => {
    await seedBook()
    const trashed = await seedBook("Abandoned")
    await P.trashProject(trashed.pid)
    const before = await snapshot()

    const file = await createBackup("full")
    await clearAll()
    expect((await snapshot()).projects).toHaveLength(0)

    const parsed = await readBackup(file)
    expect(parsed.manifest.kind).toBe("full")
    expect(parsed.manifest.projects).toHaveLength(2)
    await importBackup(parsed, "replace")

    expect(await snapshot()).toEqual(before)
  })

  it("exports one project file with only that book", async () => {
    const a = await seedBook("A")
    await seedBook("B")
    const parsed = await readBackup(await createBackup("project", [a.pid]))
    expect(parsed.manifest.kind).toBe("project")
    expect(parsed.data.projects.map((p) => p.title)).toEqual(["A"])
    expect(parsed.data.chapters.every((c) => c.projectId === a.pid)).toBe(true)
    expect(parsed.blobs.size).toBe(1)
  })

  it("replaces an existing book in place", async () => {
    const { pid, chapterId } = await seedBook()
    const file = await createBackup("project", [pid])
    await C.saveChapter(pid, chapterId, { title: "Changed after backup" })
    await N.createNote(pid, { title: "Extra", content: "added after" })

    const parsed = await readBackup(file)
    expect(await findConflicts(parsed)).toEqual([{ id: pid, title: "The Glass Tower" }])
    await importBackup(parsed, "replace")

    expect((await C.getChapter(pid, chapterId))?.title).toBe("Up")
    expect(await N.listNotesForProject(pid)).toHaveLength(1)
    expect(await db().projects.count()).toBe(1)
  })

  it("keeps both as a copy with fresh ids and working links", async () => {
    const { pid, mara } = await seedBook()
    const parsed = await readBackup(await createBackup("project", [pid]))
    const { imported } = await importBackup(parsed, "copy")

    const copyId = imported[0].id
    expect(copyId).not.toBe(pid)
    const copy = await P.getProject(copyId)
    expect(copy?.title).toBe("The Glass Tower (copy)")

    // Every record was duplicated under new ids; the original is untouched.
    expect(await db().projects.count()).toBe(2)
    expect(await db().chapters.where("projectId").equals(copyId).count()).toBe(2)
    expect(await db().versions.where("projectId").equals(copyId).count()).toBeGreaterThan(0)

    // The copy's @mention points at the copy's own character, not the original.
    const copyChars = await B.listCharactersForProject(copyId)
    expect(copyChars).toHaveLength(1)
    expect(copyChars[0].id).not.toBe(mara)
    expect(await listChaptersMentioning(copyId, "character", copyChars[0].id)).toHaveLength(1)
    expect(await listChaptersMentioning(copyId, "character", mara)).toHaveLength(0)

    // The cover points at the copy's own image.
    expect(copy?.coverFrontUrl).toMatch(/^asset:/)
    expect(copy?.coverFrontUrl).not.toBe((await P.getProject(pid))?.coverFrontUrl)
    expect(await A.getAssetBlob(copy?.coverFrontUrl)).not.toBeNull()
  })

  it("refuses files that aren't backups", async () => {
    await expect(readBackup(new Blob(["hello"]))).rejects.toBeInstanceOf(BackupError)
  })

  it("refuses files from a newer version", async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    zip.file("manifest.json", JSON.stringify({ format: "korakagaj-backup", formatVersion: 99, schemaVersion: 1 }))
    zip.file("data.json", "{}")
    await expect(readBackup(await zip.generateAsync({ type: "blob" }))).rejects.toThrow(/newer version/)
  })

  it("refuses records that belong to no book in the file", async () => {
    const { pid } = await seedBook()
    const JSZip = (await import("jszip")).default
    const zip = await JSZip.loadAsync(await createBackup("project", [pid]))
    const data = JSON.parse(await zip.file("data.json")!.async("string"))
    data.notes[0].projectId = "somewhere-else"
    zip.file("data.json", JSON.stringify(data))
    await expect(readBackup(await zip.generateAsync({ type: "blob" }))).rejects.toThrow(/belongs to no book/)
  })
})
