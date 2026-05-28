type SpotifyImage = {
  url: string;
};

type SpotifyArtist = {
  id?: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
};

type SpotifyTrack = {
  name: string;
  artists: Array<{ id?: string; name: string }>;
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

type SpotifyArtistsResponse = {
  artists: SpotifyArtist[];
};

type SpotifyNowPlayingResponse = {
  is_playing?: boolean;
  currently_playing_type?: string;
  item?: {
    name?: string;
    artists?: Array<{ name?: string }>;
    external_urls?: { spotify?: string };
    album?: { images?: SpotifyImage[] };
  };
};

type SpotifyPlayerResponse = SpotifyNowPlayingResponse;

type SpotifyNowPlaying = {
  isPlaying: boolean;
  trackName: string;
  artists: string;
  url: string | null;
  albumArtUrl: string | null;
};

export type SpotifyStats = {
  profileName: string;
  profileUrl: string;
  avatarUrl: string | null;
  nowPlaying: SpotifyNowPlaying | null;
  topGenres: string[];
  topArtists: string[];
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
    cache: "no-store",
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

function collectArtistIdsFromTracks(tracks: SpotifyTrack[], limit = 20): string[] {
  const ids = new Set<string>();

  for (const track of tracks) {
    for (const artist of track.artists) {
      if (!artist.id) continue;
      ids.add(artist.id);
      if (ids.size >= limit) {
        return [...ids];
      }
    }
  }

  return [...ids];
}

async function getArtistsByIds(
  accessToken: string,
  artistIds: string[]
): Promise<SpotifyArtist[]> {
  if (!artistIds.length) return [];

  const path = `/artists?ids=${artistIds.map(encodeURIComponent).join(",")}`;
  const result = await spotifyGet<SpotifyArtistsResponse>(accessToken, path);
  return result.data?.artists ?? [];
}

async function getNowPlaying(accessToken: string): Promise<SpotifyNowPlaying | null> {
  const toNowPlaying = (
    data: SpotifyNowPlayingResponse | null | undefined
  ): SpotifyNowPlaying | null => {
    if (!data) return null;
    if (data.currently_playing_type !== "track" || !data.item?.name) return null;

    const artists = (data.item.artists ?? [])
      .map((artist) => artist.name?.trim())
      .filter((name): name is string => Boolean(name))
      .join(", ");

    return {
      isPlaying: Boolean(data.is_playing),
      trackName: data.item.name,
      artists,
      url: data.item.external_urls?.spotify ?? null,
      albumArtUrl: data.item.album?.images?.[0]?.url ?? null,
    };
  };

  try {
    const currentResponse = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (currentResponse.ok && currentResponse.status !== 204 && currentResponse.status !== 202) {
      const currentData = (await currentResponse.json()) as SpotifyNowPlayingResponse;
      const activeTrack = toNowPlaying(currentData);
      if (activeTrack) return activeTrack;
    }

    const playerResult = await spotifyGet<SpotifyPlayerResponse>(accessToken, "/me/player");
    return toNowPlaying(playerResult.data);
  } catch {
    return null;
  }
}

export async function getSpotifyStats(): Promise<SpotifyStatsResult> {
  try {
    const tokenResult = await getAccessToken();
    if (!tokenResult.token) {
      return { stats: null, error: tokenResult.error };
    }

    const [profileResult, topArtistsResult, topTracksResult, nowPlaying] = await Promise.all([
      spotifyGet<SpotifyProfile>(tokenResult.token, "/me"),
      spotifyGet<SpotifyTopResponse<SpotifyArtist>>(
        tokenResult.token,
        "/me/top/artists?time_range=medium_term&limit=20"
      ),
      spotifyGet<SpotifyTopResponse<SpotifyTrack>>(
        tokenResult.token,
        "/me/top/tracks?time_range=medium_term&limit=5"
      ),
      getNowPlaying(tokenResult.token),
    ]);

    const profile = profileResult.data;
    const topArtists = topArtistsResult.data;
    const topTracks = topTracksResult.data;

    if (!profile || !topArtists || !topTracks) {
      const error = profileResult.error ?? topArtistsResult.error ?? topTracksResult.error;
      return { stats: null, error: error ?? "Spotify data is unavailable." };
    }

    let topGenres = computeTopGenres(topArtists.items);

    if (!topGenres.length) {
      const trackArtistIds = collectArtistIdsFromTracks(topTracks.items);
      const artistsFromTracks = await getArtistsByIds(tokenResult.token, trackArtistIds);
      topGenres = computeTopGenres(artistsFromTracks);
    }

    return {
      stats: {
        profileName: profile.display_name ?? "My Spotify",
        profileUrl: profile.external_urls?.spotify ?? "https://open.spotify.com",
        avatarUrl: profile.images?.[0]?.url ?? null,
        nowPlaying,
        topGenres,
        topArtists: topArtists.items.slice(0, 15).map((artist) => artist.name),
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
