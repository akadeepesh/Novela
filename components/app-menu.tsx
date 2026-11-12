"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { GearSixIcon, MoonIcon, ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr"
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuCheckboxItem, MenuSeparator, MenuLabel } from "@/components/ui/menu"
import { Switch } from "@/components/ui/switch"

/** The dashboard's menu: theme, and the Settings and Backup page. There are no accounts. */
export function AppMenu() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Menu>
      <MenuTrigger
        className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Settings menu"
      >
        <GearSixIcon className="size-5" />
      </MenuTrigger>

      <MenuContent>
        <MenuLabel>
          <span className="flex items-center gap-1.5">
            <ShieldCheckIcon className="size-3.5" />
            Your writing stays on this device
          </span>
        </MenuLabel>
        <MenuSeparator />

        <MenuCheckboxItem
          className="justify-between"
          checked={resolvedTheme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        >
          <span className="flex items-center gap-2">
            <MoonIcon className="size-4" />
            Dark theme
          </span>
          <Switch checked={resolvedTheme === "dark"} />
        </MenuCheckboxItem>

        <MenuItem render={<Link href="/settings" />}>
          <GearSixIcon className="size-4" />
          Settings and backup
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
