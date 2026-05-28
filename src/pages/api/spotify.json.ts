import type { APIRoute } from "astro";
import { getSpotifyStats } from "../../lib/spotify";

export const prerender = false;

export const GET: APIRoute = async () => {
  const result = await getSpotifyStats();

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};
