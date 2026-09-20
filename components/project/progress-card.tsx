import { FireIcon, TargetIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectProgress } from "@/lib/analytics"

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ProgressCard({ progress }: { progress: ProjectProgress }) {
  const { totalWordCount, targetWordCount, dailyGoal, todayWordsWritten, streakDays, last14Days } =
    progress

  const maxDay = Math.max(1, ...last14Days.map((d) => d.wordsWritten))

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm font-medium text-foreground">Progress</p>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <FireIcon
              className={streakDays > 0 ? "size-5 text-primary" : "size-5 text-muted-foreground"}
              weight={streakDays > 0 ? "fill" : "regular"}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {streakDays} day{streakDays === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">writing streak</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TargetIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {todayWordsWritten.toLocaleString()} / {dailyGoal.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">words today</p>
            </div>
          </div>
        </div>

        {targetWordCount ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalWordCount.toLocaleString()} words</span>
              <span>of {targetWordCount.toLocaleString()} target</span>
            </div>
            <ProgressBar value={totalWordCount} max={targetWordCount} />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Last 14 days</p>
          <div className="flex h-14 items-end gap-1">
            {last14Days.map((day) => (
              <div key={day.date} className="group relative flex-1">
                <div
                  className={
                    day.wordsWritten > 0
                      ? "w-full rounded-t-sm bg-primary/70 transition-all group-hover:bg-primary"
                      : "w-full rounded-t-sm bg-muted"
                  }
                  style={{ height: `${Math.max(4, (day.wordsWritten / maxDay) * 56)}px` }}
                  title={`${day.date}: ${day.wordsWritten} words`}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
