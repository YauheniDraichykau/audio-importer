"use client";
import { useEffect } from "react";

export default function AuthPopup() {
  const handleAuth = async (code: string | null, verifier: string | null) => {
    if (!code || !verifier) {
      return;
    }

    const body = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
      code_verifier: verifier,
    });

    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = await r.json();

    if (json.access_token && window.opener) {
      window.opener.postMessage(
        { source: "spotify-auth", accessToken: json.access_token },
        window.location.origin
      );
      window.close();
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = localStorage.getItem("pkce_verifier");

    handleAuth(code, verifier);
  }, []);

  return null;
}
