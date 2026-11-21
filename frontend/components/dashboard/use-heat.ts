import { useGet } from "@/hooks/api";

export interface HeatDay { date: string; count: number }
export interface Heat { days: HeatDay[]; current_streak: number; longest_streak: number; active_days: number; total: number }

/** Daily activity of the last year in the user's time zone (shared by the streak, the calendar and the weekly report). */
export function useHeat() {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return useGet<Heat>(`/activity/heatmap?days=400&tz=${encodeURIComponent(tz)}`);
}
