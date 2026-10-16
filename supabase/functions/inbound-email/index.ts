// inbound-email: forwarded booking confirmations → the traveler's import inbox.
//
// An email provider (Postmark inbound, SendGrid Inbound Parse or Mailgun routes)
// posts each email sent to <import_token>@<inbound domain> here. The URL carries
// a secret (?key=…) kept in Vault; get the full URL from /admin/stats.
//
// Nothing is added to a trip here: the email (text, HTML and up to 5 PDF/.ics/
// image attachments) is stored for the traveler, who reviews what WRLD found on
// the trip's Import page. Unknown addresses are accepted and dropped (no bounces).
import { createClient } from "npm:@supabase/supabase-js@2";

const ok = (body: unknown = { ok: true }) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/gi;
const KEEP = /^(application\/pdf|text\/calendar|application\/ics|image\/(jpeg|png|webp|heic)|application\/vnd\.apple\.pkpass)$/i;
const MAX_FILE = 10 * 1024 * 1024;
const PER_DAY = 30;

type Mail = { recipients: string; from: string; subject: string; text: string; html: string; files: { name: string; mime: string; bytes: Uint8Array }[] };

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const safeName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_ ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 100) || "file";
const mimeFor = (name: string, given: string) =>
  given && given !== "application/octet-stream" ? given : /\.ics$/i.test(name) ? "text/calendar" : /\.pdf$/i.test(name) ? "application/pdf" : /\.pkpass$/i.test(name) ? "application/vnd.apple.pkpass" : given;

async function readMail(req: Request): Promise<Mail> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    // Postmark inbound
    const j = (await req.json()) as Record<string, unknown>;
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String((x as { Email?: string }).Email ?? "")).join(" ") : "");
    const atts = Array.isArray(j.Attachments) ? (j.Attachments as { Name?: string; Content?: string; ContentType?: string }[]) : [];
    return {
      recipients: [j.OriginalRecipient, j.To, j.Cc, list(j.ToFull), list(j.CcFull), list(j.BccFull)].map((x) => String(x ?? "")).join(" "),
      from: String(j.From ?? ""),
      subject: String(j.Subject ?? ""),
      text: String(j.TextBody ?? ""),
      html: String(j.HtmlBody ?? ""),
      files: atts
        .filter((a) => a.Content && a.Name)
        .map((a) => ({ name: a.Name!, mime: mimeFor(a.Name!, a.ContentType ?? ""), bytes: b64(a.Content!) })),
    };
  }
  // SendGrid Inbound Parse or Mailgun routes (multipart form)
  const f = await req.formData();
  const s = (k: string) => {
    const v = f.get(k);
    return typeof v === "string" ? v : "";
  };
  const files: Mail["files"] = [];
  for (const [, v] of f.entries()) {
    if (v instanceof File && v.size > 0) files.push({ name: v.name, mime: mimeFor(v.name, v.type), bytes: new Uint8Array(await v.arrayBuffer()) });
  }
  return {
    recipients: [s("to"), s("cc"), s("envelope"), s("recipient"), s("To")].join(" "),
    from: s("from") || s("sender"),
    subject: s("subject"),
    text: s("text") || s("body-plain"),
    html: s("html") || s("body-html"),
    files,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try { secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { secret = undefined; }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return new Response("Not configured", { status: 500 });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (key.length < 32) return new Response("Unauthorized", { status: 401 });
  const { data: valid } = await db.rpc("inbound_email_secret_ok", { p_key: key });
  if (valid !== true) return new Response("Unauthorized", { status: 401 });

  let mail: Mail;
  try {
    mail = await readMail(req);
  } catch {
    return ok({ ignored: "unreadable" });
  }

  const tokens = [...new Set([...mail.recipients.matchAll(UUID)].map((m) => m[1].toLowerCase()))];
  if (!tokens.length) return ok({ ignored: "no address" });
  const { data: profiles } = await db.from("profiles").select("id, import_token").in("import_token", tokens).limit(3);
  if (!profiles?.length) return ok({ ignored: "unknown address" });

  const stored: string[] = [];
  for (const p of profiles) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("import_inbox").select("id", { count: "exact", head: true }).eq("user_id", p.id).gte("received_at", since);
    if ((count ?? 0) >= PER_DAY) continue;

    const id = crypto.randomUUID();
    const attachments: { name: string; mime: string; size: number; path: string }[] = [];
    for (const f of mail.files.filter((f) => KEEP.test(f.mime) && f.bytes.length <= MAX_FILE).slice(0, 5)) {
      const path = `${p.id}/${id}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name)}`;
      const { error } = await db.storage.from("import-inbox").upload(path, f.bytes, { contentType: f.mime, upsert: false });
      if (!error) attachments.push({ name: f.name.slice(0, 200), mime: f.mime, size: f.bytes.length, path });
    }
    const { error } = await db.from("import_inbox").insert({
      id,
      user_id: p.id,
      from_address: mail.from.slice(0, 320) || null,
      subject: mail.subject.slice(0, 500) || null,
      text_body: mail.text.slice(0, 200000) || null,
      html_body: mail.html.slice(0, 400000) || null,
      attachments,
    });
    if (!error) stored.push(id);
  }
  return ok({ stored: stored.length });
});
