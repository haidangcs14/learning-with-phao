"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/store/auth-store";

/** The backend redirects here after Google/Facebook login and has set the refresh cookie.
 *  The Providers component already exchanges that cookie for an access token, so we only wait for it. */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/dashboard" : "/login?error=oauth_failed");
  }, [ready, user, router]);
  return <Spinner />;
}
