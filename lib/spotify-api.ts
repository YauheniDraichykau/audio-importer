"use client";

import levenshtein from "fast-levenshtein";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  uri: string;
  isExact?: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

class SpotifyAPI {
  private getAuthToken(): string | null {
    return localStorage.getItem("spotify_access_token");
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error("No access token available");
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    return response.json();
  }

  private norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]/gi, "")
      .trim();

  private lev(a: string, b: string) {
    return levenshtein.get(this.norm(a), this.norm(b));
  }

  private getFullArtistTrack(q: string) {
    const parts = q.split(/\s+-\s+/);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        track: parts.slice(1).join(" - ").trim(),
      };
    }
    return { artist: "", track: q };
  }

  private pickBestTrack(
    items: any[],
    artist: string,
    track: string
  ): SpotifyTrack | null {
    if (!items.length) return null;

    const scored = items.map((t: any) => {
      const cleanTitle = (s: string) =>
        s
          .replace(/\([^)]*\)/g, "")
          .replace(/\b(feat|ft|version|edit|remix|piano)\b.*$/i, "")
          .trim();

      const distArtist = artist
        ? this.lev(artist, cleanTitle(t.artists[0].name))
        : 99;
      const distTitle = track ? this.lev(track, cleanTitle(t.name)) : 99;

      const bonus =
        this.norm(t.artists[0].name) === this.norm(artist)
          ? -1
          : 0 + this.norm(t.name) === this.norm(track)
          ? -1
          : 0;
      return { t, score: distArtist + distTitle + bonus };
    });

    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];

    return { ...best.t, isExact: best.score <= 4 };
  }

  async searchTrack(
    query: string,
    findSimilar = true
  ): Promise<SpotifyTrack | null> {
    try {
      const normalizeDash = (s: string) => s.replace(/[—–‒\\-]/g, "-");

      const cleanQuery = normalizeDash(query)
        .replace(/\(([^)]+)\)/g, "")
        .replace(/\b(feat|ft|live|version)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      console.log("cleanQuery", cleanQuery);

      const { artist, track } = this.getFullArtistTrack(cleanQuery);

      console.log("parsed artist", artist);
      console.log("parsed track", track);

      // First try: exact search with artist and track
      if (artist && track) {
        console.log("1. Exact search with artist and track");

        const exactQuery = `artist:"${artist}" track:"${track}"`;

        console.log("exactQuery", exactQuery);

        const exactData = await this.makeRequest(
          `/search?q=${encodeURIComponent(
            exactQuery
          )}&type=track&limit=10&market=from_token`
        );

        const foundTrack = this.pickBestTrack(
          exactData.tracks.items,
          artist,
          track
        );

        console.log("foundTrack", foundTrack);

        if (foundTrack?.isExact) {
          return foundTrack;
        }
      }

      // Second try: search by full query
      const fullQueryData = await this.makeRequest(
        `/search?q=${encodeURIComponent(
          cleanQuery
        )}&type=track&limit=10&market=from_token`
      );

      if (fullQueryData.tracks.items.length > 0) {
        console.log("2. Full query search");

        console.log(
          "2. fullQueryData tracks items",
          fullQueryData.tracks.items
        );

        const foundTrack = this.pickBestTrack(
          fullQueryData.tracks.items,
          artist,
          track
        );

        console.log("foundTrack", foundTrack);

        if (findSimilar && foundTrack) {
          console.log("2. find similar");
          return { ...foundTrack, isExact: false };
        }

        if (foundTrack) {
          console.log("2. exact match");
          return { ...foundTrack, isExact: true };
        }
      }

      // Third try: if findSimilar is enabled, try broader search
      if (findSimilar) {
        console.log("3. want to find similar");
        // Search by track name only
        if (track) {
          console.log("3. track");
          const trackOnlyData = await this.makeRequest(
            `/search?q=${encodeURIComponent(
              track
            )}&type=track&limit=10&market=from_token`
          );

          if (trackOnlyData.tracks.items.length > 0) {
            console.log("3. track only");
            // Return the most popular track (first result)
            return { ...trackOnlyData.tracks.items[0], isExact: false };
          }
        }

        // Search by artist name only
        if (artist) {
          console.log("3. artist");
          const artistOnlyData = await this.makeRequest(
            `/search?q=artist:"${artist}"&type=track&limit=10&market=from_token`
          );

          if (artistOnlyData.tracks.items.length > 0) {
            console.log("3. artist only");
            return { ...artistOnlyData.tracks.items[0], isExact: false };
          }
        }
      }
      console.log("----- END -----");
      return null;
    } catch (error) {
      console.error("Search error:", error);
      return null;
    }
  }

  async createPlaylist(name: string): Promise<SpotifyPlaylist> {
    const user = await this.makeRequest("/me");

    const data = await this.makeRequest(`/users/${user.id}/playlists`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: "Создано через VK → Spotify Importer",
        public: false,
      }),
    });

    return data;
  }

  async addTracksToPlaylist(
    playlistId: string,
    trackIds: string[]
  ): Promise<void> {
    const chunks = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      chunks.push(trackIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const uris = chunk.map((id) => `spotify:track:${id}`);
      await this.makeRequest(`/playlists/${playlistId}/tracks`, {
        method: "POST",
        body: JSON.stringify({ uris }),
      });
    }
  }

  // TODO: Add more Spotify API methods
  // - Get user playlists
  // - Search albums/artists
  // - Get track features
  // - Batch operations
}

export const spotifyApi = new SpotifyAPI();
