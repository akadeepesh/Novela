import { beforeEach, describe, expect, it } from "vitest"
import JSZip from "jszip"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { db } from "@/lib/store/db"
import { CLASSIC } from "./builtin-templates"
import { deleteImportedTemplate, getTemplate, importTemplatePack, listTemplates, PACK_FORMAT } from "./packs"
import { templateFiles } from "./template"

async function pack(over: { manifest?: object; template?: object; skipFont?: boolean } = {}) {
  const zip = new JSZip()
  const template = {
    ...JSON.parse(JSON.stringify(CLASSIC)),
    id: "fantasy/ornate",
    name: "Ornate",
    fonts: { body: { family: "Pack Serif", regular: "fonts/body.ttf" } },
    sceneBreak: { image: "ornaments/leaf.png", widthIn: 0.5 },
    ...over.template,
  }
  zip.file("pack.json", JSON.stringify({ format: PACK_FORMAT, formatVersion: 1, name: "Fantasy Pack", version: "1.0", templates: ["templates/ornate.json"], ...over.manifest }))
  zip.file("templates/ornate.json", JSON.stringify(template))
  if (!over.skipFont) zip.file("fonts/body.ttf", await readFile(path.resolve("public/fonts/crimson-pro/CrimsonPro-Regular.ttf")))
  zip.file("ornaments/leaf.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  return zip.generateAsync({ type: "blob" })
}

beforeEach(async () => {
  await Promise.all([db().templates.clear(), db().templateFiles.clear()])
})

describe("template packs", () => {
  it("imports a pack and stores its templates and files locally", async () => {
    const summary = await importTemplatePack(await pack())
    expect(summary).toEqual({ name: "Fantasy Pack", version: "1.0", templates: [{ id: "fantasy/ornate", name: "Ornate" }] })

    const t = await getTemplate("fantasy/ornate")
    expect(t?.name).toBe("Ornate")
    const refs = templateFiles(t!)
    expect(refs.every((r) => r.startsWith("tplfile:"))).toBe(true)
    expect(await db().templateFiles.count()).toBe(2)

    const all = await listTemplates()
    expect(all.map((e) => e.template.id)).toEqual(["classic", "modern", "minimal", "fantasy/ornate"])
    expect(all[3].packName).toBe("Fantasy Pack")
  })

  it("still imports packs made before the app was renamed", async () => {
    const old = await pack({ manifest: { format: "korakagaj-template-pack" }, template: { format: "korakagaj-template" } })
    expect((await importTemplatePack(old)).templates).toEqual([{ id: "fantasy/ornate", name: "Ornate" }])
  })

  it("replaces a template when the pack is imported again, and deletes cleanly", async () => {
    await importTemplatePack(await pack())
    await importTemplatePack(await pack())
    expect(await db().templates.count()).toBe(1)
    expect(await db().templateFiles.count()).toBe(2)
    await deleteImportedTemplate("fantasy/ornate")
    expect(await db().templates.count()).toBe(0)
    expect(await db().templateFiles.count()).toBe(0)
  })

  it("refuses broken or unsafe packs", async () => {
    await expect(importTemplatePack(new Blob(["nope"]))).rejects.toThrow(/isn't a template pack/)
    await expect(importTemplatePack(await pack({ manifest: { formatVersion: 9 } }))).rejects.toThrow(/newer version/)
    await expect(importTemplatePack(await pack({ skipFont: true }))).rejects.toThrow(/missing from the pack/)
    await expect(importTemplatePack(await pack({ template: { id: "classic" } }))).rejects.toThrow(/built-in/)
    await expect(
      importTemplatePack(await pack({ template: { fonts: { body: { family: "X", regular: "/fonts/eb-garamond/EBGaramond-Regular.ttf" } } } }))
    ).rejects.toThrow(/inside the pack/)
    await expect(
      importTemplatePack(await pack({ template: { fonts: { body: { family: "X", regular: "fonts/body.exe" } } } }))
    ).rejects.toThrow(/supported font/)
    expect(await db().templates.count()).toBe(0)
  })
})
