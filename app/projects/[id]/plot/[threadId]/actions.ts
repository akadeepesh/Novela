import { z } from "zod"
import { formString } from "@/lib/form"
import { createPlotThread, updatePlotThread, type PlotThreadFields } from "@/lib/store/bible"
import { TRASHED_PROJECT_ERROR } from "@/lib/store/projects"
import { PLOT_STATUSES, type PlotStatus } from "@/lib/plot-config"

const STATUS_VALUES = PLOT_STATUSES.map((s) => s.value) as [PlotStatus, ...PlotStatus[]]

const schema = z.object({
  title: z.string().trim().min(1, "Give this thread a title").max(120),
  status: z.enum(STATUS_VALUES),
  aliases: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
  resolvedChapterId: z.string().max(100).optional(),
})

export type UpdatePlotThreadState = {
  error?: string
  success?: boolean
  /** Set after creating: the page to open next. */
  redirectTo?: string
}

function splitList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : []
}

function parse(formData: FormData): { ok: true; fields: PlotThreadFields } | { ok: false; error: string } {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    status: formData.get("status"),
    aliases: formString(formData, "aliases"),
    description: formString(formData, "description"),
    notes: formString(formData, "notes"),
    resolvedChapterId: formString(formData, "resolvedChapterId"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  const d = parsed.data
  return {
    ok: true,
    fields: {
      title: d.title,
      status: d.status,
      aliases: splitList(d.aliases),
      description: d.description ?? "",
      notes: d.notes ?? "",
      resolvedChapterId: d.resolvedChapterId && d.resolvedChapterId !== "none" ? d.resolvedChapterId : undefined,
    },
  }
}

export async function updatePlotThreadAction(
  projectId: string,
  threadId: string,
  _prevState: UpdatePlotThreadState,
  formData: FormData
): Promise<UpdatePlotThreadState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  return (await updatePlotThread(projectId, threadId, parsed.fields)) ? { success: true } : { error: TRASHED_PROJECT_ERROR }
}

/**
 * Creates the record from the blank "new" form. Nothing exists until this
 * runs, so opening the form and walking away leaves no stray record.
 */
export async function createPlotThreadFromFormAction(
  projectId: string,
  _prevState: UpdatePlotThreadState,
  formData: FormData
): Promise<UpdatePlotThreadState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  const id = await createPlotThread(projectId, parsed.fields)
  if (!id) return { error: TRASHED_PROJECT_ERROR }
  return { redirectTo: `/projects/${projectId}/plot/${id}` }
}
