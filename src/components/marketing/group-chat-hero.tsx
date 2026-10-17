/**
 * The homepage's one moving moment: a real-sounding group chat plays in, then settles into a WRLD
 * plan. Example people; the prices are U.S. averages (sources below). Plays once; static with reduced motion.
 *
 * Example prices, per person, 4 friends, 4 nights:
 *   flights $522: average domestic round-trip fare, Bureau of Transportation Statistics, Q1 2026
 *   hotel $321: average U.S. room rate $160.54/night (CoStar, 2025), 2 rooms for 4, 4 nights
 *   food $338: $135/day for two (BLS 2024 via The Motley Fool, 2026), 5 days
 *   plans $200: WRLD's allowance for tickets and activities
 *   $1,500 max: about what Americans spend per trip (MMGY Portrait of American Travelers, fall 2026:
 *   $5,655 over 3.9 trips is about $1,450)
 */
const MESSAGES: { who: string; text: string; me?: boolean }[] = [
  { who: "Jo", text: "ok are we actually doing Nashville for Maya's 30th??" },
  { who: "Sam", text: "I'm in if it's under $1,500" },
  { who: "Ana", text: "same, rent just went up 😭" },
  { who: "You", text: "WRLD has it at $1,381 each. And my points cover the hotel", me: true },
  { who: "Jo", text: "wait HOW 👀" },
];

const INITIAL_BG: Record<string, string> = { Jo: "#ffd5c2", Sam: "#cfe3ff", Ana: "#e3d6ff" };

export function GroupChatHero() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
      <figcaption className="sr-only">
        Example at typical U.S. prices: four friends plan four nights in Nashville for $1,381 each, under everyone&rsquo;s $1,500 max: flights
        $522, a shared hotel room $321, food $338 and plans $200. Your points cover the hotel, so each friend owes you $321.
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
              <p className="font-display text-lg font-semibold leading-tight">Nashville for Maya&rsquo;s 30th</p>
              <p className="text-xs opacity-80">4 friends, 4 nights, typical U.S. prices</p>
            </div>
            <span className="shrink-0 rounded-full bg-travel px-2.5 py-1 text-xs font-semibold text-travel-foreground">Under everyone&rsquo;s $1,500</span>
          </div>
          <dl className="mt-3 grid gap-1.5 px-4 pb-4 text-sm">
            {[
              ["Round-trip flight", "$522"],
              ["Hotel, 4 nights, sharing a room", "$321"],
              ["Food", "$338"],
              ["Plans and tickets", "$200"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="opacity-80">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-primary-foreground/20 pt-2">
              <dt className="font-medium">Everything, each</dt>
              <dd className="font-display text-base font-semibold tabular-nums">$1,381</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between gap-3 bg-travel px-4 py-3 text-travel-foreground">
            <p className="text-sm font-semibold">Your points cover the hotel. Each friend owes you $321</p>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-travel-foreground px-3 py-1 text-xs font-semibold text-travel">Settle up</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
