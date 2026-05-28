type SpotifyImage = {
  url: string;
};

type SpotifyArtist = {
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
};

type SpotifyTrack = {
  name: string;
  artists: Array<{ name: string }>;
  external_urls?: { spotify?: string };
};

type SpotifyProfile = {
  display_name?: string;
  external_urls?: { spotify?: string };
  images?: SpotifyImage[];
};

type SpotifyTopResponse<T> = {
  items: T[];
};

export type SpotifyStats = {
  profileName: string;
  profileUrl: string;
  avatarUrl: string | null;
  topGenres: string[];
  topTracks: Array<{
    name: string;
    artists: string;
    url: string | null;
  }>;
};

export type SpotifyStatsResult = {
  stats: SpotifyStats | null;
  error: string | null;
};

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function normalizeEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

async function getAccessToken(): Promise<{ token: string | null; error: string | null }> {
  const clientId = normalizeEnv(import.meta.env.SPOTIFY_CLIENT_ID);
  const clientSecret = normalizeEnv(import.meta.env.SPOTIFY_CLIENT_SECRET);
  const refreshToken = normalizeEnv(import.meta.env.SPOTIFY_REFRESH_TOKEN);

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      token: null,
      error: "Missing env vars. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN.",
    };
  }

  const authorization = toBase64(`${clientId}:${clientSecret}`);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    let message = `Token request failed (${response.status})`;

    try {
      const errorData = (await response.json()) as {
        error?: string;
        error_description?: string;
      };

      if (errorData.error || errorData.error_description) {
        message = [errorData.error, errorData.error_description]
          .filter(Boolean)
          .join(": ");
      }
    } catch {
      // no-op
    }

    return { token: null, error: message };
  }

  const tokenData = (await response.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return { token: null, error: "Spotify token response had no access_token." };
  }

  return { token: tokenData.access_token, error: null };
}

async function spotifyGet<T>(
  accessToken: string,
  path: string
): Promise<{ data: T | null; error: string | null }> {
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let message = `Spotify API failed for ${path} (${response.status})`;

    try {
      const errorData = (await response.json()) as {
        error?: { status?: number; message?: string };
      };

      if (errorData.error?.message) {
        message = `${path}: ${errorData.error.message}`;
      }
    } catch {
      // no-op
    }

    return { data: null, error: message };
  }

  return { data: (await response.json()) as T, error: null };
}

function computeTopGenres(artists: SpotifyArtist[], limit = 8): string[] {
  const counts = new Map<string, number>();

  for (const artist of artists) {
    for (const genre of artist.genres ?? []) {
      const normalized = genre.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

export async function getSpotifyStats(): Promise<SpotifyStatsResult> {
  try {
    const tokenResult = await getAccessToken();
    if (!tokenResult.token) {
      return { stats: null, error: tokenResult.error };
    }

    const [profileResult, topArtistsResult, topTracksResult] = await Promise.all([
      spotifyGet<SpotifyProfile>(tokenResult.token, "/me"),
      spotifyGet<SpotifyTopResponse<SpotifyArtist>>(
        tokenResult.token,
        "/me/top/artists?time_range=medium_term&limit=12"
      ),
      spotifyGet<SpotifyTopResponse<SpotifyTrack>>(
        tokenResult.token,
        "/me/top/tracks?time_range=medium_term&limit=5"
      ),
    ]);

    const profile = profileResult.data;
    const topArtists = topArtistsResult.data;
    const topTracks = topTracksResult.data;

    if (!profile || !topArtists || !topTracks) {
      const error = profileResult.error ?? topArtistsResult.error ?? topTracksResult.error;
      return { stats: null, error: error ?? "Spotify data is unavailable." };
    }

    const topGenres = computeTopGenres(topArtists.items);

    return {
      stats: {
        profileName: profile.display_name ?? "My Spotify",
        profileUrl: profile.external_urls?.spotify ?? "https://open.spotify.com",
        avatarUrl: profile.images?.[0]?.url ?? null,
        topGenres,
        topTracks: topTracks.items.map((track) => ({
          name: track.name,
          artists: track.artists.map((artist) => artist.name).join(", "),
          url: track.external_urls?.spotify ?? null,
        })),
      },
      error: null,
    };
  } catch {
    return { stats: null, error: "Unexpected error while loading Spotify stats." };
  }
}
