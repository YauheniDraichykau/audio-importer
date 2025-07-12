"use client";

import { pkcePair } from "@/utils/pkce";
import { useState, useEffect } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI as string;
const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-email",
  "user-read-private",
].join(" ");

export function useSpotifyAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      console.log("HANDLER WORKS");
      if (e.origin !== window.location.origin) return; // safety
      if (e.data?.source === "spotify-auth") {
        localStorage.setItem("spotify_access_token", e.data.accessToken);
        setAccessToken(e.data.accessToken);
        window.focus();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("spotify_access_token");
    if (stored) setAccessToken(stored);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (r.ok) {
          setUser(await r.json());
        } else {
          localStorage.removeItem("spotify_access_token");
          setAccessToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  const login = async () => {
    const { verifier, challenge } = await pkcePair();
    localStorage.setItem("pkce_verifier", verifier);

    const qs = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SCOPES,
      state: crypto.randomUUID(),
    });

    window.open(
      `https://accounts.spotify.com/authorize?${qs}`,
      "spotifyAuth",
      "popup,width=500,height=650"
    );
  };

  const logout = () => {
    localStorage.removeItem("spotify_access_token");
    setAccessToken(null);
    setUser(null);
  };

  return {
    isAuthenticated: !!accessToken,
    accessToken,
    user,
    isLoading: loading,
    login,
    logout,
  };
}
