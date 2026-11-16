/** Reads a design token (e.g. "--primary") for canvas / WebGL drawing, where Tailwind classes cannot be used. Re-read on every frame so a theme switch shows at once. */
export function tokenColor(name: string, alpha = 1): string {
  if (typeof document === "undefined") return `rgba(16,185,129,${alpha})`;
  const channels = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return channels.length === 3 && channels.every(Number.isFinite) ? `rgba(${channels[0]},${channels[1]},${channels[2]},${alpha})` : `rgba(16,185,129,${alpha})`;
}
