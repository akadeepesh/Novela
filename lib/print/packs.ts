import JSZip from "jszip"
import { db, newId, nowIso, type TemplateRecord } from "@/lib/store/db"
import { BUILTIN_TEMPLATES } from "./builtin-templates"
import { TemplateError, mapTemplateFiles, templateFiles, validateTemplate, type PrintTemplate } from "./template"

/**
 * Template packs: a zip with a `pack.json` manifest, one or more template
 * JSON files, and the fonts and ornaments they use. Packs are imported into
 * the browser's database; nothing is uploaded and nothing is locked. See
 * templates/spec.md for the format.
 */

export const PACK_FORMAT = "korakagaj-template-pack"
export const PACK_FORMAT_VERSION = 1

const FILE_TYPES: Record<string, { type: string; maxBytes: number }> = {
  ttf: { type: "font/ttf", maxBytes: 15 * 1024 * 1024 },
  otf: { type: "font/otf", maxBytes: 15 * 1024 * 1024 },
  woff: { type: "font/woff", maxBytes: 15 * 1024 * 1024 },
  png: { type: "image/png", maxBytes: 5 * 1024 * 1024 },
  jpg: { type: "image/jpeg", maxBytes: 5 * 1024 * 1024 },
  jpeg: { type: "image/jpeg", maxBytes: 5 * 1024 * 1024 },
}
const MAX_PACK_BYTES = 80 * 1024 * 1024
const MAX_TEMPLATES = 30

const FILE_PREFIX = "tplfile:"

export type PackSummary = { name: string; version?: string; templates: { id: string; name: string }[] }

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Opens and checks a template pack, then stores its templates and files. Re-importing a template id replaces it. */
export async function importTemplatePack(file: Blob): Promise<PackSummary> {
  if (file.size > MAX_PACK_BYTES) throw new TemplateError("This pack is too large (over 80 MB).")
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new TemplateError("This isn't a template pack.")
  }
  const manifestFile = zip.file("pack.json")
  if (!manifestFile) throw new TemplateError("This isn't a template pack (no pack.json).")
  let manifest: unknown
  try {
    manifest = JSON.parse(await manifestFile.async("string"))
  } catch {
    throw new TemplateError("The pack's pack.json is damaged.")
  }
  if (!isObj(manifest) || manifest.format !== PACK_FORMAT) throw new TemplateError("This isn't a template pack.")
  if (typeof manifest.formatVersion !== "number" || manifest.formatVersion > PACK_FORMAT_VERSION) {
    throw new TemplateError("This pack needs a newer version of the app. Reload to update, then try again.")
  }
  const name = typeof manifest.name === "string" && manifest.name.trim() ? manifest.name.trim().slice(0, 80) : "Template pack"
  const version = typeof manifest.version === "string" ? manifest.version.slice(0, 40) : undefined
  const list = manifest.templates
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TEMPLATES || !list.every((t) => typeof t === "string")) {
    throw new TemplateError("pack.json should list the pack's template files under “templates”.")
  }

  const builtinIds = new Set(BUILTIN_TEMPLATES.map((t) => t.id))
  const prepared: { template: PrintTemplate; files: Map<string, { blob: Blob; type: string }> }[] = []
  for (const path of list as string[]) {
    const entry = zip.file(path)
    if (!entry) throw new TemplateError(`The pack lists “${path}”, but it isn't in the file.`)
    let template: PrintTemplate
    try {
      template = validateTemplate(JSON.parse(await entry.async("string")))
    } catch (err) {
      throw err instanceof TemplateError ? new TemplateError(`${path}: ${err.message}`) : new TemplateError(`${path} is damaged.`)
    }
    if (builtinIds.has(template.id)) throw new TemplateError(`${path}: the id “${template.id}” belongs to a built-in template.`)
    const files = new Map<string, { blob: Blob; type: string }>()
    for (const ref of templateFiles(template)) {
      if (ref.startsWith("/")) throw new TemplateError(`${path}: “${ref}” must be a file inside the pack.`)
      const ext = ref.split(".").pop()?.toLowerCase() ?? ""
      const kind = FILE_TYPES[ext]
      if (!kind) throw new TemplateError(`${path}: “${ref}” isn't a supported font or image (TTF, OTF, WOFF, PNG, JPEG).`)
      const f = zip.file(ref)
      if (!f) throw new TemplateError(`${path}: “${ref}” is missing from the pack.`)
      const bytes = await f.async("uint8array")
      if (bytes.byteLength > kind.maxBytes) throw new TemplateError(`${path}: “${ref}” is too large.`)
      files.set(ref, { blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: kind.type }), type: kind.type })
    }
    prepared.push({ template, files })
  }

  const d = db()
  await d.transaction("rw", d.templates, d.templateFiles, async () => {
    for (const { template, files } of prepared) {
      await d.templateFiles.where("templateId").equals(template.id).delete()
      const ids = new Map<string, string>()
      for (const [path, f] of files) {
        const id = newId()
        ids.set(path, id)
        await d.templateFiles.add({ id, templateId: template.id, path, blob: f.blob, type: f.type })
      }
      const record: TemplateRecord = {
        id: template.id,
        template: mapTemplateFiles(template, (ref) => FILE_PREFIX + ids.get(ref)!),
        packName: name,
        packVersion: version,
        importedAt: nowIso(),
      }
      await d.templates.put(record)
    }
  })
  return { name, version, templates: prepared.map((p) => ({ id: p.template.id, name: p.template.name })) }
}

export async function deleteImportedTemplate(id: string): Promise<void> {
  const d = db()
  await d.transaction("rw", d.templates, d.templateFiles, async () => {
    await d.templateFiles.where("templateId").equals(id).delete()
    await d.templates.delete(id)
  })
}

export type TemplateEntry = { template: PrintTemplate; source: "builtin" | "imported"; packName?: string }

/** Every template available here: the built-in ones first, then imported ones by name. */
export async function listTemplates(): Promise<TemplateEntry[]> {
  const imported = await db().templates.toArray()
  return [
    ...BUILTIN_TEMPLATES.map((template) => ({ template, source: "builtin" as const })),
    ...imported
      .sort((a, b) => a.template.name.localeCompare(b.template.name))
      .map((r) => ({ template: r.template, source: "imported" as const, packName: r.packName })),
  ]
}

export async function getTemplate(id: string): Promise<PrintTemplate | null> {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? (await db().templates.get(id))?.template ?? null
}

/**
 * Makes a template's files loadable: bundled paths stay as they are; an
 * imported template's files become object URLs. Call `dispose` when done.
 */
export async function templateFileResolver(template: PrintTemplate): Promise<{ resolveFile: (ref: string) => string; dispose: () => void }> {
  const urls = new Map<string, string>()
  for (const ref of templateFiles(template)) {
    if (!ref.startsWith(FILE_PREFIX) || urls.has(ref)) continue
    const rec = await db().templateFiles.get(ref.slice(FILE_PREFIX.length))
    if (rec) urls.set(ref, URL.createObjectURL(rec.blob))
  }
  return {
    resolveFile: (ref) => urls.get(ref) ?? ref,
    dispose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  }
}
