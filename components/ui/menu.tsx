import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "cn"

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger

function MenuContent({
  className,
  children,
  sideOffset = 8,
  align = "end",
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "sideOffset" | "align">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} className="z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            "min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function MenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="menu-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel }
