// TEMPORARY (remove after choosing stock photos): lets a text-only review tool check Unsplash photos.
//   ?page=<unsplash photo slug>  -> license line, photographer, photo id (from the public photo page)
//   ?id=photo-...                -> a small preview as base64 text
// Only unsplash.com / images.unsplash.com, only small sizes.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const page = sp.get("page");
  if (page) {
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(page)) return new Response("bad page", { status: 400 });
    const res = await fetch(`https://unsplash.com/photos/${page}`, { headers: { "user-agent": "Mozilla/5.0 WRLD photo check" } });
    const html = await res.text();
    const id = html.match(/images\.unsplash\.com\/(photo-[0-9]+-[0-9a-f]+)/)?.[1] ?? null;
    const free = /Free to use under the Unsplash License/.test(html);
    const plus = /Unsplash\+ License/.test(html);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
    const by = html.match(/"name":"([^"]+)","first_name"/)?.[1] ?? html.match(/Photo by ([^,<"]+)/)?.[1] ?? null;
    return Response.json({ status: res.status, id, free, plus, title, by });
  }
  const id = sp.get("id") ?? "";
  if (!/^photo-[0-9]+-[0-9a-f]+$/.test(id)) return new Response("bad id", { status: 400 });
  const w = Math.min(720, Math.max(200, Number(sp.get("w")) || 480));
  const res = await fetch(`https://images.unsplash.com/${id}?w=${w}&q=60&fm=jpg&fit=crop`);
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: 502 });
  const buf = Buffer.from(await res.arrayBuffer());
  return new Response(buf.toString("base64"), { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
