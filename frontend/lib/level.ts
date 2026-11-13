export interface Tier { ring: string; badge: string }

/** The look of the level frame grows with the level. */
export function levelTier(level: number): Tier {
  if (level >= 35) return { ring: "ring-rose-400", badge: "border-rose-200 bg-gradient-to-r from-rose-500 to-orange-400 text-white" };
  if (level >= 20) return { ring: "ring-amber-400", badge: "border-amber-200 bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950" };
  if (level >= 10) return { ring: "ring-violet-400", badge: "border-violet-200 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white" };
  if (level >= 5) return { ring: "ring-emerald-400", badge: "border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-500 text-white" };
  return { ring: "ring-indigo-300", badge: "border-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-500 text-white" };
}

/** The user's full name; the username only when no name was entered. */
export const displayName = (u: { full_name?: string; username: string }): string => u.full_name?.trim() || u.username;
