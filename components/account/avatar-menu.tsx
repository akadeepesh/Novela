"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { GearSixIcon, ChatCircleTextIcon, SignOutIcon, MoonIcon } from "@phosphor-icons/react/dist/ssr"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel } from "@/components/ui/menu"
import { Switch } from "@/components/ui/switch"
import { FeedbackDialog } from "./feedback-dialog"
import { avatarColor, avatarInitials } from "@/lib/avatar"
import { signOutAction } from "@/app/dashboard/actions"

export function AvatarMenu() {
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const name = session?.user?.name
  const email = session?.user?.email
  const image = session?.user?.image
  const seed = email || name || "user"

  return (
    <>
      <Menu>
        <MenuTrigger
          className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Account menu"
        >
          <Avatar>
            {image ? <AvatarImage src={image} alt={name || "Account"} /> : null}
            <AvatarFallback style={{ background: avatarColor(seed) }}>
              {avatarInitials(name, email)}
            </AvatarFallback>
          </Avatar>
        </MenuTrigger>

        <MenuContent>
          <MenuLabel>
            <p className="truncate font-medium text-foreground">{name || "Your account"}</p>
            <p className="truncate">{email}</p>
          </MenuLabel>
          <MenuSeparator />

          <MenuItem className="justify-between" onClick={(e) => e.preventDefault()}>
            <span className="flex items-center gap-2">
              <MoonIcon className="size-4" />
              Dark theme
            </span>
            <Switch
              checked={resolvedTheme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </MenuItem>

          <MenuItem render={<Link href="/settings" />}>
            <GearSixIcon className="size-4" />
            Settings
          </MenuItem>

          <MenuItem onClick={() => setFeedbackOpen(true)}>
            <ChatCircleTextIcon className="size-4" />
            Send feedback
          </MenuItem>

          <MenuSeparator />

          <MenuItem onClick={() => void signOutAction()} className="text-destructive">
            <SignOutIcon className="size-4" />
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  )
}
