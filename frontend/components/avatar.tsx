/* eslint-disable @next/next/no-img-element */
import { API_URL } from "@/lib/api";
import { levelTier } from "@/lib/level";

/** Own uploads are served by the API (relative URL); Google/Facebook avatars are absolute URLs. */
export const avatarSrc = (url?: string): string => (!url ? "" : /^https?:/.test(url) ? url : `${API_URL}${url}`);

export function Avatar({ user, size = 32 }: { user: { username: string; avatar_url?: string }; size?: number }) {
  const src = avatarSrc(user.avatar_url);
  const box = { width: size, height: size, fontSize: size * 0.45 };
  return src
    ? <img src={src} alt="" style={box} className="shrink-0 rounded-full object-cover" />
    : <span style={box} className="flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold uppercase text-white">{user.username.slice(0, 1)}</span>;
}

/** Avatar with a rounded level frame on its lower edge ("Lv.12"). The ring and the frame change colour as the level grows. */
export function LevelAvatar({ user, level, size = 32 }: { user: { username: string; avatar_url?: string }; level?: number; size?: number }) {
  const tier = levelTier(level ?? 1);
  const small = size < 44;
  return (
    <span className={`relative inline-block shrink-0 ${level !== undefined ? (small ? "pb-1.5" : "pb-2.5") : ""}`}>
      <span className={`block rounded-full ${level !== undefined ? `ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ${tier.ring}` : ""}`}><Avatar user={user} size={size} /></span>
      {level !== undefined && (
        <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 font-extrabold leading-none shadow ${tier.badge} ${small ? "px-1.5 py-px text-[9px]" : "px-3 py-0.5 text-sm"}`}>Lv.{level}</span>
      )}
    </span>
  );
}
