import "server-only";

// This file previously contained gamification logic (daily progress tracking,
// streaks, goals). That system has been removed per the Phase 2 plan. The
// DailyStat model and deprecated project fields (dailyWordGoal, targetWordCount)
// remain in the database unused, to be cleaned up in a future migration.
