import type { NextRequest } from "next/server";

const VK_TOKEN = process.env.VK_TOKEN!;
const VK_VERSION = "5.199";

export async function GET(req: NextRequest) {
  const accessKey = process.env.VK_ACCESS_KEY;
  const link = req.nextUrl.searchParams.get("link") ?? "";
  try {
    const { ownerId, playlistId } = parseVkLink(link);
    if (!ownerId) throw new Error("Bad VK link");

    let items: any[] = [];

    if (playlistId) {
      const pl = await vk("audio.getPlaylistById", {
        owner_id: ownerId,
        playlist_id: playlistId,
        access_key: accessKey ?? undefined,
      });

      const gr = await vk("audio.get", {
        owner_id: ownerId,
        album_id: playlistId,
        access_key: accessKey ?? undefined,
        count: 3000,
      });

      items = gr.response?.items ?? [];
    } else {
      const resp = await vk("audio.get", { owner_id: ownerId, count: 6000 });
      items = resp.response.items;
    }

    if (!items.length) {
      throw new Error("Playlist is empty or not accessible");
    }

    const tracks = items.map((t) => `${t.artist} - ${t.title}`);

    return Response.json({ tracks });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

function parseVkLink(link: string) {
  const path = link.replace(/^https?:\/\/(?:www\.)?vk\.com/, "");

  const m1 = path.match(/\/audios(-?\d+)/);
  if (m1) return { ownerId: m1[1], playlistId: null, accessKey: null };

  const m2 = path.match(/playlist\/(-?\d+)_(\d+)(?:_([\\w-]+))?/);
  if (m2)
    return {
      ownerId: m2[1],
      playlistId: m2[2],
      accessKey: m2[3] ?? null,
    };

  return { ownerId: null, playlistId: null, accessKey: null };
}

async function vk(method: string, params: Record<string, any>) {
  const qs = new URLSearchParams({
    access_token: VK_TOKEN,
    v: VK_VERSION,
    ...params,
  });
  const r = await fetch(`https://api.vk.com/method/${method}?${qs}`);
  const json = await r.json();

  if (json.error) {
    throw new Error(`VK ${json.error.error_code}: ${json.error.error_msg}`);
  }
  return json;
}
