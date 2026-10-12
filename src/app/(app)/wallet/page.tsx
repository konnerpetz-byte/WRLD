import { Link2, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteManualAccount, disconnectWallet } from "@/features/wallet/actions";
import { AWARDWALLET_DISCLOSURE } from "@/features/wallet/copy";
import { ManualAccountForm } from "@/features/wallet/manual-account-form";
import { formatPoints } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Points wallet" };

const KIND_LABEL = { airline: "Airlines", hotel: "Hotels", bank: "Credit card points", car_rental: "Car rental", other: "Other" } as const;

export default async function WalletPage() {
  const { supabase } = await requireUserId();
  const [{ data: accounts }, { data: programs }, { data: connections }, { data: reachable }] = await Promise.all([
    supabase.from("loyalty_accounts").select("*").order("balance", { ascending: false }),
    supabase.from("loyalty_programs").select("id, name, kind, unit_name").order("name"),
    supabase.from("wallet_connections").select("*"),
    supabase.from("wallet_reachable_points").select("*").eq("route", "transfer"),
  ]);
  const programById = new Map((programs ?? []).map((p) => [p.id, p]));
  const connection = connections?.[0];
  const connectReady = Boolean(process.env.AWARDWALLET_CLIENT_ID && process.env.AWARDWALLET_AUTHORIZE_URL);

  const groups = Object.entries(KIND_LABEL)
    .map(([kind, label]) => ({ label, accounts: (accounts ?? []).filter((a) => programById.get(a.program_id)?.kind === kind) }))
    .filter((g) => g.accounts.length);

  return (
    <div className="mx-auto grid max-w-5xl gap-10">
      <header>
        <h1 className="text-4xl font-semibold">Points wallet</h1>
        <p className="mt-1 text-muted-foreground">Every airline, hotel and credit card balance in one place, ready to use for flights and stays.</p>
      </header>

      <section aria-labelledby="connect" className="grid gap-6 rounded-2xl border bg-card p-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <h2 id="connect" className="text-2xl font-semibold">{AWARDWALLET_DISCLOSURE.title}</h2>
          <ul className="mt-4 grid max-w-prose gap-2.5 text-sm">
            {AWARDWALLET_DISCLOSURE.body.map((line) => (
              <li key={line} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-open" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            {AWARDWALLET_DISCLOSURE.noAccountLabel}{" "}
            <a href={AWARDWALLET_DISCLOSURE.learnMoreUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
              Visit AwardWallet
            </a>
          </p>
        </div>
        <div className="grid gap-2 md:min-w-56">
          {connection ? (
            <>
              <Badge className="bg-open text-open-foreground">Connected</Badge>
              <p className="text-sm text-muted-foreground">
                {connection.last_synced_at ? `Last updated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connection.last_synced_at))}` : "First sync in progress"}
              </p>
              <form action={disconnectWallet.bind(null, connection.id)}>
                <Button type="submit" variant="outline" size="sm">Disconnect</Button>
              </form>
            </>
          ) : connectReady ? (
            <Button asChild size="lg">
              <a href="/api/wallet/awardwallet/connect">
                <Link2 aria-hidden="true" /> {AWARDWALLET_DISCLOSURE.connectLabel}
              </a>
            </Button>
          ) : (
            <>
              <Button size="lg" disabled>
                <Link2 aria-hidden="true" /> {AWARDWALLET_DISCLOSURE.connectLabel}
              </Button>
              <p className="text-xs text-muted-foreground">Available once the app&rsquo;s AwardWallet access is set up.</p>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="balances">
        <h2 id="balances" className="mb-4 text-xl font-semibold">Your balances</h2>
        {!groups.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-muted-foreground">
            No balances yet. Connect above, or add a program by hand below.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.label}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{g.label}</h3>
                <ul className="divide-y rounded-xl border bg-card">
                  {g.accounts.map((a) => {
                    const p = programById.get(a.program_id);
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex-1">
                          <span className="block font-medium">{p?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.source === "connected" ? "Synced" : "Added by hand"}
                            {a.member_last4 ? `, ending ${a.member_last4}` : ""}
                            {a.points_expire_on ? `, expires ${a.points_expire_on}` : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-display text-lg font-semibold">{formatPoints(a.balance)}</span>
                          <span className="text-xs text-muted-foreground">{p?.unit_name}</span>
                        </span>
                        {a.source === "manual" && (
                          <form action={deleteManualAccount.bind(null, a.id)}>
                            <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remove ${p?.name}`}>
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {!!reachable?.length && (
          <div className="mt-6 rounded-xl border border-travel bg-travel-soft p-4 text-sm">
            <h3 className="mb-2 font-medium">Points you could transfer</h3>
            <ul className="grid gap-1">
              {reachable.map((r) => (
                <li key={`${r.via_program_id}-${r.target_program_id}`}>
                  {formatPoints(r.points)} {programById.get(r.target_program_id)?.name} from {programById.get(r.via_program_id)?.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="manual" className="rounded-xl border bg-card p-5">
        <h2 id="manual" className="mb-1 text-lg font-semibold">Add a program by hand</h2>
        <p className="mb-4 text-sm text-muted-foreground">For programs that can&rsquo;t be synced. You&rsquo;ll need to update these yourself.</p>
        <ManualAccountForm programs={(programs ?? []).map(({ id, name }) => ({ id, name }))} />
      </section>
    </div>
  );
}
