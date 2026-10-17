// TEMPORARY (remove after choosing stock photos): returns a small Unsplash image as base64 text so
// it can be reviewed from a tool that only reads text. Only images.unsplash.com, only small sizes.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^photo-[0-9]+-[0-9a-f]+$/.test(id)) return new Response("bad id", { status: 400 });
  const res = await fetch(`https://images.unsplash.com/${id}?w=480&q=60&fm=jpg&fit=crop`);
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: 502 });
  const buf = Buffer.from(await res.arrayBuffer());
  return new Response(buf.toString("base64"), { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
