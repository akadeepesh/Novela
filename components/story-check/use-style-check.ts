"use client"

import { useEffect, useMemo, useState } from "react"
import type { Editor } from "@tiptap/react"
import { useLiveQuery } from "dexie-react-hooks"
import { listCharacterRecords, listWorldEntryRecords } from "@/lib/store/bible"
import { useProject } from "@/lib/store/hooks"
import { getStyleCheckState, type StyleCheckConfig, type StyleCheckState } from "@/components/editor/style-check-extension"

/**
 * Keeps the editor's style checks configured from the book's settings and
 * story bible. `panelOpen` turns them on; highlights keep them on with the
 * panel closed.
 */
export function useConfigureStyleCheck(editor: Editor | null, projectId: string, panelOpen: boolean) {
  const settings = useProject(projectId)?.styleCheck
  const bible = useLiveQuery(async () => {
    const [characters, places] = await Promise.all([listCharacterRecords(projectId), listWorldEntryRecords(projectId)])
    return {
      characters: characters.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] })),
      names: places.flatMap((p) => [p.name, ...(p.aliases ?? [])]),
    }
  }, [projectId])

  // Live queries hand back new objects on every change anywhere in the
  // book; only reconfigure (and re-run the checks) when something we use
  // actually changed.
  const key = JSON.stringify([settings, bible, panelOpen])
  const config = useMemo<StyleCheckConfig | null>(() => {
    if (!settings || !bible) return null
    return { active: panelOpen || settings.highlights, settings, characters: bible.characters, names: bible.names }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (editor && !editor.isDestroyed && config) editor.commands.configureStyleCheck(config)
  }, [editor, config])
}

/** The latest style findings and stats, re-rendering when new results arrive. */
export function useStyleCheckResults(editor: Editor): StyleCheckState | undefined {
  const [state, setState] = useState(() => getStyleCheckState(editor.state))
  useEffect(() => {
    const update = () => {
      const next = getStyleCheckState(editor.state)
      // Only results and config changes matter; mapped ranges alone don't.
      setState((prev) =>
        prev && next && prev.findings === next.findings && prev.stats === next.stats && prev.config === next.config ? prev : next
      )
    }
    update()
    editor.on("transaction", update)
    return () => {
      editor.off("transaction", update)
    }
  }, [editor])
  return state
}
