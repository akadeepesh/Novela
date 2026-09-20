import type { Icon } from "@phosphor-icons/react"
import { FileTextIcon, LinkIcon, ImageIcon } from "@phosphor-icons/react/dist/ssr"

export const RESEARCH_ENTRY_TYPES = [
  { value: "note", label: "Note", icon: FileTextIcon },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "image", label: "Image", icon: ImageIcon },
] as const satisfies { value: string; label: string; icon: Icon }[]

export type ResearchEntryType = (typeof RESEARCH_ENTRY_TYPES)[number]["value"]

export function researchEntryTypeLabel(type: ResearchEntryType): string {
  return RESEARCH_ENTRY_TYPES.find((t) => t.value === type)?.label ?? type
}

export function researchEntryTypeIcon(type: ResearchEntryType): Icon {
  return RESEARCH_ENTRY_TYPES.find((t) => t.value === type)?.icon ?? FileTextIcon
}
