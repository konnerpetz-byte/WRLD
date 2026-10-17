// TEMPORARY (remove right after checking the last stock photo): returns one Unsplash image as base64 text.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (id !== "photo-1457537227909-08f41319e53c") return new Response("bad id", { status: 400 });
  const res = await fetch(`https://images.unsplash.com/${id}?w=1100&q=70&fm=jpg`);
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: 502 });
  return new Response(Buffer.from(await res.arrayBuffer()).toString("base64"), { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
