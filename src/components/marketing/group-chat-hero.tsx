/**
 * The homepage's one moving moment: a real-sounding group chat plays in, then settles into a WRLD
 * plan with a fair points split. Example people and numbers; plays once; static with reduced motion.
 */
const MESSAGES: { who: string; text: string; me?: boolean }[] = [
  { who: "Jo", text: "ok are we actually doing Lisbon for Maya's 30th??" },
  { who: "Sam", text: "I'm in if it's under $1,200" },
  { who: "Ana", text: "same, rent just went up 😭" },
  { who: "You", text: "WRLD found a plan for $1,140 each. Flights on my miles", me: true },
  { who: "Jo", text: "wait HOW 👀" },
];

const INITIAL_BG: Record<string, string> = { Jo: "#ffd5c2", Sam: "#cfe3ff", Ana: "#e3d6ff" };

export function GroupChatHero() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
      <figcaption className="sr-only">
        Example: a group chat planning a trip to Lisbon becomes a WRLD plan that fits everyone&rsquo;s budget at $1,140 each. Going in
        May instead of June saves $210 each, official ticket sites save $46 each, and your miles cover the flights, so each friend owes
        you $360.
      </figcaption>
      <div aria-hidden="true" className="rounded-[2rem] border bg-card p-4 shadow-[0_40px_80px_-40px_rgb(15_61_51/0.45)] sm:p-5">
        <div className="mb-3 flex items-center gap-3 border-b pb-3">
          <div className="flex -space-x-2">
            {["Jo", "Sam", "Ana"].map((n) => (
              <span key={n} className="grid size-8 place-items-center rounded-full border-2 border-card text-xs font-semibold text-foreground" style={{ background: INITIAL_BG[n] }}>
                {n[0]}
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Maya&rsquo;s 30th 🎂</p>
            <p className="text-xs text-muted-foreground">You, Jo, Sam, Ana</p>
          </div>
        </div>

        <ol className="grid gap-1.5">
          {MESSAGES.map((m, i) => (
            <li key={i} className={`chat-step flex flex-col ${m.me ? "items-end" : "items-start"}`} style={{ "--step": i } as React.CSSProperties}>
              {!m.me && <span className="mb-0.5 ml-3 text-[11px] text-muted-foreground">{m.who}</span>}
              <span
                className={`max-w-[80%] rounded-[1.15rem] px-3.5 py-2 text-[15px] leading-snug ${
                  m.me ? "rounded-br-md bg-chat text-chat-foreground" : "rounded-bl-md bg-chat-friend text-foreground"
                }`}
              >
                {m.text}
              </span>
            </li>
          ))}
        </ol>

        {/* The plan the chat turns into */}
        <div className="chat-step mt-4 overflow-hidden rounded-2xl bg-primary text-primary-foreground" style={{ "--step": MESSAGES.length + 0.6 } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              <p className="font-display text-lg font-semibold leading-tight">Lisbon for Maya&rsquo;s 30th</p>
              <p className="text-xs opacity-80">4 friends, May 14 to 18</p>
            </div>
            <span className="shrink-0 rounded-full bg-travel px-2.5 py-1 text-xs font-semibold text-travel-foreground">Under everyone&rsquo;s max</span>
          </div>
          <dl className="mt-3 grid gap-2 px-4 pb-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="opacity-80">Everything, each</dt>
              <dd className="font-display text-base font-semibold">$1,140</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="opacity-80">May instead of June</dt>
              <dd className="font-display text-base font-semibold text-travel">saves $210 each</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="opacity-80">Tickets from official sites</dt>
              <dd className="font-display text-base font-semibold text-travel">saves $46 each</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between gap-3 bg-travel px-4 py-3 text-travel-foreground">
            <p className="text-sm font-semibold">Your miles cover flights. Each friend owes you $360</p>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-travel-foreground px-3 py-1 text-xs font-semibold text-travel">Settle up</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
