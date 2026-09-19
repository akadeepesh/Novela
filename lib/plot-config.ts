export const PLOT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "abandoned", label: "Abandoned" },
] as const

export type PlotStatus = (typeof PLOT_STATUSES)[number]["value"]

export function plotStatusLabel(status: PlotStatus): string {
  return PLOT_STATUSES.find((s) => s.value === status)?.label ?? status
}
