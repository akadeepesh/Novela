"use client"

import { useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { getProject, getDashboardData, listTrashedProjects, countTrashedProjects } from "./projects"
import { getChapter, listChaptersForProject, listTrashedChapters } from "./chapters"
import {
  getCharacter,
  getPlotThread,
  getWorldEntry,
  listCharactersForProject,
  listPlotThreadsForProject,
  listWorldEntriesForProject,
} from "./bible"
import { getNote, getResearchEntry, listNotesForProject, listResearchEntriesForProject } from "./notes"
import { listSearchIndexForProject } from "./search"
import { listChaptersMentioning, listMentionablesForProject, type MentionableType } from "./mentions"

/**
 * React hooks over the local database. Each re-renders by itself whenever
 * the data it read changes, in this tab or another one, so nothing needs a
 * manual refresh after a write.
 *
 * Every hook returns `undefined` while loading. Single-record hooks return
 * `null` when the record doesn't exist (show "not found").
 */

export const useProject = (id: string) => useLiveQuery(() => getProject(id), [id])
export const useDashboardData = () => useLiveQuery(getDashboardData, [])
export const useTrashedProjects = () => useLiveQuery(listTrashedProjects, [])
export const useTrashCount = () => useLiveQuery(countTrashedProjects, [])

export const useChapters = (projectId: string) => useLiveQuery(() => listChaptersForProject(projectId), [projectId])
export const useTrashedChapters = (projectId: string) =>
  useLiveQuery(() => listTrashedChapters(projectId), [projectId])
export const useChapter = (projectId: string, id: string) => useLiveQuery(() => getChapter(projectId, id), [projectId, id])

export const useCharacters = (projectId: string) =>
  useLiveQuery(() => listCharactersForProject(projectId), [projectId])
export const useCharacter = (projectId: string, id: string) =>
  useLiveQuery(() => getCharacter(projectId, id), [projectId, id])

export const useWorldEntries = (projectId: string) =>
  useLiveQuery(() => listWorldEntriesForProject(projectId), [projectId])
export const useWorldEntry = (projectId: string, id: string) =>
  useLiveQuery(() => getWorldEntry(projectId, id), [projectId, id])

export const usePlotThreads = (projectId: string) =>
  useLiveQuery(() => listPlotThreadsForProject(projectId), [projectId])
export const usePlotThread = (projectId: string, id: string) =>
  useLiveQuery(() => getPlotThread(projectId, id), [projectId, id])

export const useNotes = (projectId: string) => useLiveQuery(() => listNotesForProject(projectId), [projectId])
export const useNote = (projectId: string, id: string) => useLiveQuery(() => getNote(projectId, id), [projectId, id])

export const useResearchEntries = (projectId: string) =>
  useLiveQuery(() => listResearchEntriesForProject(projectId), [projectId])
export const useResearchEntry = (projectId: string, id: string) =>
  useLiveQuery(() => getResearchEntry(projectId, id), [projectId, id])

export const useSearchIndex = (projectId: string) =>
  useLiveQuery(() => listSearchIndexForProject(projectId), [projectId])
export const useMentionables = (projectId: string) =>
  useLiveQuery(() => listMentionablesForProject(projectId), [projectId])
export const useChaptersMentioning = (projectId: string, type: MentionableType, id: string) =>
  useLiveQuery(() => listChaptersMentioning(projectId, type, id), [projectId, type, id])

/**
 * Reads once, without live updates. For screens that take a starting value
 * and then own it (the chapter editor), where re-rendering on every
 * autosave would only cost time. Key the component on the record id to
 * reload for another record.
 */
export function useSnapshot<T>(load: () => Promise<T>): T | undefined {
  const [value, setValue] = useState<{ v: T } | undefined>(undefined)
  const loadRef = useRef(load)
  useEffect(() => {
    let cancelled = false
    loadRef.current().then((v) => {
      if (!cancelled) setValue({ v })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return value?.v
}
