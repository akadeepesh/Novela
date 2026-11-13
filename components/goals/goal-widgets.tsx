"use client"

import { cn } from "cn"
import { FireIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DebouncedInput } from "@/components/ui/committed-input"
import { Label } from "@/components/ui/label"
import { useGoalProgress } from "@/lib/store/hooks"
import { MAX_DAILY_GOAL, setDailyWordGoal, type GoalProgress } from "@/lib/store/goals"

/** A small progress ring, full when the goal is met. */
function Ring({ value, size = 14 }: { value: number; size?: number }) {
  const r = (size - 3) / 2
  const c = 2 * Math.PI * r
  const done = Math.min(1, Math.max(0, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={2.5} className="stroke-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={2.5}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done)}
        strokeLinecap="round"
        className={done >= 1 ? "stroke-emerald-500" : "stroke-primary"}
      />
    </svg>
  )
}

/** "Today 420 / 500" for the editor's footer. Hidden when goals are off. */
export function TodayGoal({ projectId }: { projectId: string }) {
  const p = useGoalProgress(projectId)
  if (!p || p.goal <= 0) return null
  const done = p.today >= p.goal
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={done ? "Daily goal met. Nice work." : `${(p.goal - p.today).toLocaleString()} words to go today`}
    >
      <Ring value={p.today / p.goal} />
      Today {p.today.toLocaleString()} / {p.goal.toLocaleString()}
      {p.streak > 1 ? (
        <span className="inline-flex items-center gap-0.5">
          · <FireIcon className="size-3 text-orange-500" weight="fill" />
          {p.streak} days
        </span>
      ) : null}
    </span>
  )
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function Heatmap({ p }: { p: GoalProgress }) {
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="Words written over the last 30 days">
      {p.recent.map((d) => {
        const share = p.goal > 0 ? d.words / p.goal : d.words > 0 ? 1 : 0
        const level = d.words === 0 ? 0 : share >= 1 ? 4 : share >= 0.66 ? 3 : share >= 0.33 ? 2 : 1
        return (
          <span
            key={d.date}
            role="listitem"
            title={`${dayLabel(d.date)}: ${d.words.toLocaleString()} words`}
            aria-label={`${dayLabel(d.date)}: ${d.words.toLocaleString()} words`}
            className={cn(
              "size-4 rounded-[3px]",
              level === 0 && "bg-muted",
              level === 1 && "bg-primary/20",
              level === 2 && "bg-primary/45",
              level === 3 && "bg-primary/70",
              level === 4 && "bg-primary"
            )}
          />
        )
      })}
    </div>
  )
}

/** The Book Settings card: set the daily goal, see streaks and the last 30 days. */
export function GoalCard({ projectId }: { projectId: string }) {
  const p = useGoalProgress(projectId)
  if (!p) return null
  const total30 = p.recent.reduce((n, d) => n + d.words, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily writing goal</CardTitle>
        <CardDescription>
          Words you add count toward today. Deleting or rewriting never takes them away. Set 0 to turn goals off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Label htmlFor="daily-goal">Words a day</Label>
          <DebouncedInput
            id="daily-goal"
            inputMode="numeric"
            value={String(p.goal)}
            onCommit={(v) => void setDailyWordGoal(projectId, Number(v.replace(/[^\d]/g, "")))}
            aria-describedby="daily-goal-max"
            className="w-24"
          />
          <span id="daily-goal-max" className="text-xs text-muted-foreground">
            up to {MAX_DAILY_GOAL.toLocaleString()}
          </span>
        </div>

        {p.goal > 0 ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="flex items-center gap-1.5 font-medium tabular-nums">
                <Ring value={p.today / p.goal} size={16} />
                {p.today.toLocaleString()} / {p.goal.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="flex items-center gap-1 font-medium tabular-nums">
                {p.streak > 0 ? <FireIcon className="size-4 text-orange-500" weight="fill" /> : null}
                {p.streak} {p.streak === 1 ? "day" : "days"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Best streak</p>
              <p className="font-medium tabular-nums">
                {p.best} {p.best === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>Last 30 days</span>
            <span>{total30.toLocaleString()} words</span>
          </p>
          <Heatmap p={p} />
        </div>
      </CardContent>
    </Card>
  )
}
