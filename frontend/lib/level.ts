export interface Tier { ring: string; badge: string }

/** The look of the level frame grows with the level (only design tokens, so it follows the theme). */
export function levelTier(level: number): Tier {
  if (level >= 35) return { ring: "ring-error", badge: "border-error/40 bg-gradient-to-r from-error to-accent text-error-foreground" };
  if (level >= 20) return { ring: "ring-accent", badge: "border-accent/40 bg-gradient-to-r from-accent to-primary text-accent-foreground" };
  if (level >= 10) return { ring: "ring-accent", badge: "border-accent/40 bg-accent text-accent-foreground" };
  if (level >= 5) return { ring: "ring-secondary", badge: "border-secondary/40 bg-secondary text-secondary-foreground" };
  return { ring: "ring-primary/50", badge: "border-primary/40 bg-primary text-primary-foreground" };
}

/** The user's full name; the username only when no name was entered. */
export const displayName = (u: { full_name?: string; username: string }): string => u.full_name?.trim() || u.username;

/** Rank title shown on the dashboard (a translation key). */
export function levelTitle(level: number): string {
  if (level >= 35) return "Bậc thầy";
  if (level >= 20) return "Chuyên gia";
  if (level >= 10) return "Thành thạo";
  if (level >= 5) return "Học viên";
  return "Người mới";
}
