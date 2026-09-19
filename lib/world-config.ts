import type { Icon } from "@phosphor-icons/react"
import {
  MapPinIcon,
  UsersFourIcon,
  CubeIcon,
} from "@phosphor-icons/react/dist/ssr"

export const WORLD_ENTRY_TYPES = [
  { value: "location", label: "Location", icon: MapPinIcon },
  { value: "faction", label: "Faction", icon: UsersFourIcon },
  { value: "item", label: "Item", icon: CubeIcon },
] as const satisfies { value: string; label: string; icon: Icon }[]

export type WorldEntryType = (typeof WORLD_ENTRY_TYPES)[number]["value"]

export function worldEntryTypeLabel(type: WorldEntryType): string {
  return WORLD_ENTRY_TYPES.find((t) => t.value === type)?.label ?? type
}

export function worldEntryTypeIcon(type: WorldEntryType): Icon {
  return WORLD_ENTRY_TYPES.find((t) => t.value === type)?.icon ?? MapPinIcon
}
