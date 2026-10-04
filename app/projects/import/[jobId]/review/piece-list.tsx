"use client"

import { useEffect, useRef, useState } from "react"
import { Reorder, useDragControls, useReducedMotion } from "motion/react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  LinkSimpleIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu"
import { firstLines } from "@/lib/import/review/doc-ops"
import type { ReviewAction } from "@/lib/import/review/state"
import { needsLook, type ReviewPiece } from "@/lib/import/review/types"

type Dispatch = (action: ReviewAction) => void

const pages = (p: ReviewPiece) => (p.startPage === p.endPage ? `p. ${p.startPage}` : `pp. ${p.startPage}–${p.endPage}`)

export function PieceList({
  pieces,
  selectedId,
  onSelect,
  dispatch,
  reorderable,
  noun,
}: {
  pieces: ReviewPiece[]
  selectedId: string
  onSelect: (id: string) => void
  dispatch: Dispatch
  /** Dragging only makes sense on the full list — a filtered view has gaps in it. */
  reorderable: boolean
  noun: string
}) {
  // While a row is being dragged the order is local; it's committed (one undo step) when the drop lands.
  const [order, setOrder] = useState(pieces)
  const orderRef = useRef(order)
  useEffect(() => {
    setOrder(pieces)
    orderRef.current = pieces
  }, [pieces])

  const commitOrder = () => dispatch({ type: "reorder", ids: orderRef.current.map((p) => p.id) })
  const numbered = new Map(pieces.map((p, i) => [p.id, i]))

  if (!reorderable) {
    return (
      <ol className="flex flex-col gap-3">
        {pieces.map((p) => (
          <li key={p.id}>
            <Row piece={p} index={numbered.get(p.id) ?? 0} total={pieces.length} selected={p.id === selectedId} onSelect={onSelect} dispatch={dispatch} noun={noun} />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <Reorder.Group
      as="ol"
      axis="y"
      values={order}
      onReorder={(next) => {
        orderRef.current = next
        setOrder(next)
      }}
      className="flex flex-col gap-3"
    >
      {order.map((p) => (
        <DraggableRow key={p.id} piece={p} index={numbered.get(p.id) ?? 0} total={pieces.length} selected={p.id === selectedId} onSelect={onSelect} dispatch={dispatch} noun={noun} onDrop={commitOrder} />
      ))}
    </Reorder.Group>
  )
}

function DraggableRow(props: RowProps & { onDrop: () => void }) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()
  return (
    <Reorder.Item
      as="li"
      value={props.piece}
      dragListener={false}
      dragControls={controls}
      onDragEnd={props.onDrop}
      whileDrag={reduceMotion ? undefined : { scale: 1.015, boxShadow: "0 18px 30px -16px rgb(0 0 0 / 0.45)", zIndex: 20 }}
      className="relative"
    >
      <Row {...props} handle={<DragHandle controls={controls} />} />
    </Reorder.Item>
  )
}

function DragHandle({ controls }: { controls: ReturnType<typeof useDragControls> }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault()
        controls.start(e)
      }}
      aria-label="Drag to reorder"
      className="mt-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-30 outline-none transition-opacity group-hover/row:opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <DotsSixVerticalIcon className="size-4" weight="bold" />
    </button>
  )
}

type RowProps = {
  piece: ReviewPiece
  index: number
  total: number
  selected: boolean
  onSelect: (id: string) => void
  dispatch: Dispatch
  noun: string
  handle?: React.ReactNode
}

function Row({ piece, index, total, selected, onSelect, dispatch, noun, handle }: RowProps) {
  const look = needsLook(piece)
  const snippet = firstLines(piece.doc, 2).join(" / ")
  const last = index === total - 1

  return (
    <div
      onClick={() => onSelect(piece.id)}
      className={cn(
        "group/row relative rounded-2xl border p-3 transition-colors",
        selected ? "border-primary/50 bg-card shadow-sm ring-1 ring-primary/25" : "border-current/10 bg-card/50 hover:border-current/25 hover:bg-card/80",
        look && !selected && "border-amber-500/30"
      )}
    >
      <div className="flex items-start gap-1.5">
        {handle ?? <span className="size-6 shrink-0" aria-hidden />}

        <span aria-hidden className="mt-0.5 w-8 shrink-0 text-right font-serif text-base tabular-nums opacity-40">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <input
            key={piece.title}
            defaultValue={piece.title}
            aria-label={`Title of ${noun} ${index + 1}`}
            onFocus={() => onSelect(piece.id)}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (v && v !== piece.title) dispatch({ type: "rename", id: piece.id, title: v })
              else e.currentTarget.value = piece.title
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              else if (e.key === "Escape") {
                e.currentTarget.value = piece.title
                e.currentTarget.blur()
              } else if (e.altKey && e.key === "ArrowUp") {
                e.preventDefault()
                dispatch({ type: "move", id: piece.id, to: index - 1 })
              } else if (e.altKey && e.key === "ArrowDown") {
                e.preventDefault()
                dispatch({ type: "move", id: piece.id, to: index + 1 })
              }
            }}
            className="w-full truncate rounded-md bg-transparent px-1 py-0.5 -mx-1 font-serif text-[17px] leading-snug outline-none transition-colors hover:bg-current/5 focus:bg-background focus:ring-2 focus:ring-ring/60"
          />
          {snippet ? <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug italic opacity-55">{snippet}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
            <span className="tabular-nums">{pages(piece)}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{piece.wordCount.toLocaleString("en-US")} words</span>
            {look ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 opacity-100 dark:text-amber-300">
                <WarningIcon className="size-3" weight="fill" />
                Worth a look
              </span>
            ) : piece.checked && piece.flags.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-primary opacity-100">
                <CheckIcon className="size-3" weight="bold" />
                Checked
              </span>
            ) : null}
          </div>
        </div>

        <Menu>
          <MenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${noun} ${index + 1}`} onClick={(e) => e.stopPropagation()} />}
          >
            <DotsThreeIcon weight="bold" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem disabled={last} onClick={() => dispatch({ type: "merge", id: piece.id })}>
              <LinkSimpleIcon /> Join with the next {noun}
            </MenuItem>
            <MenuItem disabled={index === 0} onClick={() => dispatch({ type: "move", id: piece.id, to: index - 1 })}>
              <ArrowUpIcon /> Move up
            </MenuItem>
            <MenuItem disabled={last} onClick={() => dispatch({ type: "move", id: piece.id, to: index + 1 })}>
              <ArrowDownIcon /> Move down
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled={total <= 1} onClick={() => dispatch({ type: "remove", id: piece.id })} className="text-destructive">
              <TrashIcon /> Leave this {noun} out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {!last ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: "merge", id: piece.id })
          }}
          aria-label={`Join ${noun} ${index + 1} with the next ${noun}`}
          className="absolute -bottom-[15px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-current/20 bg-background px-2.5 py-0.5 text-[11px] font-medium opacity-0 shadow-sm outline-none transition-opacity group-hover/row:opacity-100 hover:border-primary hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LinkSimpleIcon className="size-3" weight="bold" />
          Join with next
        </button>
      ) : null}
    </div>
  )
}
