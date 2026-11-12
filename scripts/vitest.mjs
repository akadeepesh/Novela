// Runs Vitest from the project's real on-disk path. On Windows a terminal can
// report the drive as "d:" while files resolve to "D:", which makes Vitest
// load two copies of itself and fail with "failed to find the runner".
import { realpathSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const cwd = realpathSync.native(process.cwd())
const result = spawnSync(process.execPath, [join(cwd, "node_modules", "vitest", "vitest.mjs"), ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
})
process.exit(result.status ?? 1)
