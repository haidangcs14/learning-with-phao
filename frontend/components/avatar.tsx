/* eslint-disable @next/next/no-img-element */
import { API_URL } from "@/lib/api";

/** Own uploads are served by the API (relative URL); Google/Facebook avatars are absolute URLs. */
export const avatarSrc = (url?: string): string => (!url ? "" : /^https?:/.test(url) ? url : `${API_URL}${url}`);

export function Avatar({ user, size = 32 }: { user: { username: string; avatar_url?: string }; size?: number }) {
  const src = avatarSrc(user.avatar_url);
  const box = { width: size, height: size, fontSize: size * 0.45 };
  return src
    ? <img src={src} alt="" style={box} className="shrink-0 rounded-full object-cover" />
    : <span style={box} className="flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold uppercase text-white">{user.username.slice(0, 1)}</span>;
}
