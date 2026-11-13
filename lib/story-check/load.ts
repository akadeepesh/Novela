import { db } from "@/lib/store/db"
import { listChapterRecords } from "@/lib/store/chapters"
import { listCharacterRecords, listPlotThreadRecords, listWorldEntryRecords } from "@/lib/store/bible"
import { DEFAULT_STORY_CHECK_SETTINGS, type StoryCheckInput } from "./types"

/** Reads everything Story Check needs for one project from the local database. */
export async function loadStoryCheckInput(projectId: string): Promise<StoryCheckInput | null> {
  const project = await db().projects.get(projectId)
  if (!project || project.deletedAt) return null
  const [chapters, characters, places, threads] = await Promise.all([
    listChapterRecords(projectId),
    listCharacterRecords(projectId),
    listWorldEntryRecords(projectId),
    listPlotThreadRecords(projectId),
  ])
  return {
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.title,
      order: c.order,
      content: c.content,
      flashback: c.flashback,
      storyDate: c.storyDate,
    })),
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases ?? [],
      role: c.role,
      eyeColor: c.eyeColor,
      hairColor: c.hairColor,
      birthYear: c.birthYear,
      pronouns: c.pronouns,
      status: c.status,
      statusChapterId: c.statusChapterId,
    })),
    places: places.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases ?? [] })),
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      aliases: t.aliases ?? [],
      status: t.status,
      resolvedChapterId: t.resolvedChapterId,
    })),
    settings: { ...DEFAULT_STORY_CHECK_SETTINGS, ...project.storyCheck },
  }
}
