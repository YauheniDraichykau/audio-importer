"use client";

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

  async searchTrack(
    query: string,
    findSimilar = true
  ): Promise<SpotifyTrack | null> {
    const getFullArtistTrack = (q: string) => {
      const parts = q.split(/\s+-\s+/);
      if (parts.length >= 2) {
        return {
          artist: parts[0].trim(),
          track: parts.slice(1).join(" - ").trim(),
        };
      }
      return { artist: "", track: q };
    };

    try {
      const normalizeDash = (s: string) => s.replace(/[—–‒\\-]/g, "-");

      const cleanQuery = normalizeDash(query)
        .replace(/\(([^)]+)\)/g, "")
        .replace(/\b(feat|ft|live|version)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      console.log("cleanQuery", cleanQuery);

      const { artist, track } = getFullArtistTrack(cleanQuery);

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
          )}&type=track&limit=1&market=from_token`
        );

        console.log("exactData", exactData);
        console.log("exactData tracks", exactData.tracks);
        console.log("exactData tracks items", exactData.tracks.items);

        if (exactData.tracks.items.length > 0) {
          return { ...exactData.tracks.items[0], isExact: true };
        }
      }

      // Second try: search by full query
      const fullQueryData = await this.makeRequest(
        `/search?q=${encodeURIComponent(
          cleanQuery
        )}&type=track&limit=1&market=from_token`
      );

      if (fullQueryData.tracks.items.length > 0) {
        console.log("2. Full query search");
        console.log("2. fullQueryData", fullQueryData);
        console.log("2. fullQueryData tracks", fullQueryData.tracks);
        console.log(
          "2. fullQueryData tracks items",
          fullQueryData.tracks.items
        );

        const foundTrack = fullQueryData.tracks.items[0];

        // Check if it's a close match
        if (this.isCloseMatch(cleanQuery, foundTrack, artist, track)) {
          console.log("2. close match");
          return { ...foundTrack, isExact: true };
        }

        if (findSimilar) {
          console.log("2. find similar");
          return { ...foundTrack, isExact: false };
        }
      }

      // Third try: if findSimilar is enabled, try broader search
      if (findSimilar) {
        console.log("3. want to find similar");
        // Search by track name only
        if (track) {
          console.log("3. track");
          const trackOnlyData = await this.makeRequest(
            `/search?q=${encodeURIComponent(track)}&type=track&limit=5`
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
            `/search?q=artist:"${artist}"&type=track&limit=5`
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

  private isCloseMatch(
    originalQuery: string,
    foundTrack: SpotifyTrack,
    artist: string,
    track: string
  ): boolean {
    const foundArtist = foundTrack.artists[0]?.name.toLowerCase() || "";
    const foundTitle = foundTrack.name.toLowerCase();

    if (artist && track) {
      console.log("- Close match. artist and track");
      const artistMatch =
        foundArtist.includes(artist.toLowerCase()) ||
        artist.toLowerCase().includes(foundArtist);
      console.log("- Close match. artistMatch", artistMatch);
      const trackMatch =
        foundTitle.includes(track.toLowerCase()) ||
        track.toLowerCase().includes(foundTitle);
      console.log("- Close match. trackMatch", trackMatch);

      return artistMatch && trackMatch;
    }

    const queryWords = originalQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const foundWords = (foundArtist + " " + foundTitle).split(/\s+/);

    const matchingWords = queryWords.filter((word) =>
      foundWords.some(
        (foundWord) => foundWord.includes(word) || word.includes(foundWord)
      )
    );
    console.log("- Close match. matchingWords", matchingWords);
    console.log(
      "- Close match. Math.min(2, queryWords.length)",
      Math.min(2, queryWords.length)
    );
    console.log(
      "- Close match. matchingWords.length >= Math.min(2, queryWords.length)",
      matchingWords.length >= Math.min(2, queryWords.length)
    );
    return matchingWords.length >= Math.min(2, queryWords.length);
  }

  async createPlaylist(name: string): Promise<SpotifyPlaylist> {
    // Get current user ID
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
