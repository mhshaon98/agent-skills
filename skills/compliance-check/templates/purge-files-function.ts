// TEMPLATE (compliance-check). Tested in production as a
// Supabase edge function (e.g. supabase/functions/purge-chat-images). Rename: BUCKET, RETAIN_DAYS, the two RPC names,
// and the path convention ("<owner>/<file>"). Deploy with verify_jwt on; the function
// itself also requires role == service_role. Schedule via pg_cron + pg_net with the key
// from Vault (templates/setup-script-skeleton.sh does all of it).

// supabase/functions/purge-chat-images/index.ts
//
// Completes the 90-day support-chat retention promised in the privacy policy
// ("Support conversations, and any image attached to one, are deleted 90 days
// after the last message in the thread"). The SQL job purge_old_chat(90) deletes
// stale threads WITHOUT images; this function deletes stale threads WITH images,
// because bucket bytes can only be removed through the Storage API.
//
// Order per thread (never orphans bytes behind deleted rows):
//   1. remove the objects the thread's messages reference;
//   2. only if that succeeded, delete the rows via purge_image_thread(), which
//      re-checks staleness atomically (a revived thread survives);
//   3. only if the thread is gone, clear anything else under chat-images/<owner>/.
// A failure leaves the thread for the next daily run.
//
// AUTHORIZATION: fired only by pg_cron through pg_net with the service-role key.
// verify_jwt = true proves the token is valid; this function additionally
// requires role == "service_role", exactly like notify.

// PC-SEC-019: exact pinned version, same as the other functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const env = (k: string) => Deno.env.get(k)!;
const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const BUCKET = "chat-images";
const RETAIN_DAYS = 90;
const PAGE = 100;
const MAX_PAGES = 200;
const MAX_THREADS_PER_RUN = 50;

function callerRole(authHeader: string): string | undefined {
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return undefined;
  try {
    const part = m[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part))?.role;
  } catch {
    return undefined;
  }
}

// image_url holds a bucket path ("<owner>/<uuid>.jpg"); tolerate a full URL too.
function toPath(v: string): string | null {
  if (!v) return null;
  const i = v.indexOf(`/${BUCKET}/`);
  const p = i >= 0 ? v.slice(i + BUCKET.length + 2).split("?")[0] : v;
  return p.length > 0 ? decodeURIComponent(p) : null;
}

async function purgePrefix(owner: string): Promise<boolean> {
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data: files, error } = await supabase.storage.from(BUCKET).list(owner, { limit: PAGE });
    if (error) return false;
    if (!files || files.length === 0) return true;
    const { error: rmErr } = await supabase.storage.from(BUCKET)
      .remove(files.map((f) => `${owner}/${f.name}`));
    if (rmErr) return false;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if (callerRole(req.headers.get("Authorization") ?? "") !== "service_role") {
    return new Response("forbidden", { status: 403 });
  }

  const { data: threads, error } = await supabase.rpc("stale_image_threads", { retain_days: RETAIN_DAYS });
  if (error) {
    console.error("purge-chat-images: list failed");
    return Response.json({ ok: false, failures: ["list"] }, { status: 500 });
  }

  let purged = 0, kept = 0, failed = 0;
  for (const t of (threads ?? []).slice(0, MAX_THREADS_PER_RUN) as { owner: string; paths: string[] }[]) {
    const paths = (t.paths ?? []).map(toPath).filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (rmErr) { failed++; continue; }
    }
    const { data: n, error: delErr } = await supabase.rpc("purge_image_thread", { o: t.owner, retain_days: RETAIN_DAYS });
    if (delErr) { failed++; continue; }
    if (!n) { kept++; continue; } // revived since the scan
    if (!(await purgePrefix(t.owner))) { failed++; continue; }
    purged++;
  }

  // Counts only: no owner ids, paths, or message content in responses or logs.
  console.log(`purge-chat-images: purged=${purged} kept=${kept} failed=${failed}`);
  return Response.json({ ok: failed === 0, purged, kept, failed });
});
