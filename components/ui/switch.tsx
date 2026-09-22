import { cn } from "cn"

/**
 * A purely visual on/off indicator — not an interactive control.
 *
 * Real `<Switch>` elements are for use standalone (a settings page row with
 * its own click target). Inside a menu, the *row* is what's clickable —
 * `MenuCheckboxItem` owns the click, keyboard and screen-reader semantics —
 * so this only reflects `checked`, it doesn't handle input itself.
 */
function Switch({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      data-slot="switch"
      aria-hidden
      data-checked={checked || undefined}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-muted transition-colors",
        "data-[checked]:bg-primary",
        className
      )}
    >
      <span
        data-slot="switch-thumb"
        data-checked={checked || undefined}
        className="block size-4 translate-x-0.5 rounded-full bg-card shadow-sm transition-transform data-[checked]:translate-x-[18px]"
      />
    </span>
  )
}

export { Switch }
