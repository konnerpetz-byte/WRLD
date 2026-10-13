/**
 * A day in Lisbon, drawn to real geography (Mercator, from real coordinates):
 * the coast from Cabo da Roca to the Tagus, the Rossio–Sintra railway, Pena
 * Palace, and an inset of central Lisbon at walking scale. Generated once from
 * coordinates; colors come from theme tokens so it works in light and dark.
 */

const LABEL = { fill: "var(--map-label)", fontFamily: "inherit" } as const;
const HALO = { paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 2.2, strokeLinejoin: "round" } as const;

function Pin({ x, y, label, stay = false, r = 5.5 }: { x: number; y: number; label: string; stay?: boolean; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={stay ? "var(--sidebar)" : "var(--brand)"} stroke="var(--brand-cream)" strokeWidth="1.4" />
      <text textAnchor="middle" dy={r * 0.36} fontSize={r * 1.15} fontWeight="700" fill="var(--brand-cream)">
        {label}
      </text>
    </g>
  );
}

/** The whole day: Lisbon to Pena Palace and back, with central Lisbon inset. */
export function LisbonDayMap({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 200" className={className} role="img" aria-label="Map of the day: start at Memmo Alfama in Lisbon, ride Tram 28 through the Alfama, take the train to Pena Palace in Sintra, and end at a fado house in Mouraria" preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id="ldm-inset">
          <rect x="0" y="0" width="120" height="84" rx="7" />
        </clipPath>
      </defs>
      <rect width="300" height="200" fill="var(--map-land)" />
      <path d="M22.3 66.9C24.4 60.6 33.0 57.4 41.5 55.5C50.0 53.6 64.4 54.0 73.4 55.5C82.4 57.0 90.9 60.7 95.7 64.5C100.5 68.3 104.2 73.4 102.1 78.4C100.0 83.5 91.5 90.7 83 94.8C74.5 98.9 60.1 103.2 51.1 102.9C42.1 102.6 33.5 99.1 28.7 93.1C23.9 87.1 20.2 73.2 22.3 66.9Z" fill="var(--map-park)" />
      <path d="M-51.1 -21.6C-36.4 -62.5 22.3 -25.3 37 -21.6C51.7 -17.9 37.6 -7.6 37 0.6C36.4 8.8 34.3 20.6 33.2 27.6C32.1 34.6 31.9 38.6 30.6 42.4C29.3 46.2 27.4 47.5 25.5 50.5C23.6 53.5 21.3 56.0 19.1 60.4C16.9 64.8 12.1 71.3 12.1 76.8C12.1 82.3 16.7 87.9 19.1 93.1C21.6 98.3 25.0 103.9 26.8 107.9C28.6 111.9 30.9 112.8 30 116.9C29.1 121.0 22.0 128.2 21.7 132.4C21.4 136.6 23.7 139.6 28.1 142.2C32.5 144.8 43.1 146.7 47.9 147.9C52.7 149.1 54.3 149.5 56.8 149.2C59.3 148.9 59.6 147.9 63.2 146.3C66.8 144.7 73.1 139.4 78.5 139.4C83.9 139.4 91.0 144.1 95.7 146.3C100.4 148.6 103.0 150.7 106.6 152.9C110.2 155.1 114.5 157.6 117.4 159.4C120.3 161.2 120.5 164.4 123.8 163.5C127.1 162.6 133.7 156.3 137.2 153.7C140.7 151.1 141.4 149.7 144.9 147.9C148.4 146.1 151.7 143.7 158.3 143C164.9 142.3 177.5 143.1 184.5 143.9C191.5 144.7 194.8 148.6 200.4 147.9C206.0 147.2 211.7 141.4 218.3 139.8C224.9 138.2 235.6 138.6 240 138.1C244.4 137.6 243.4 137.1 244.9 136.7C246.4 136.3 247.4 136.4 248.9 135.7C250.4 135.0 251.3 135.1 253.7 132.4C256.1 129.7 260.4 123.8 263 119.3C265.6 114.8 267.8 110.0 269.4 105.4C271.0 100.8 272.5 96.3 272.6 91.5C272.7 86.7 270.8 81.3 270 76.8C269.3 72.3 267.2 71.3 268.1 64.5C269.1 57.7 272.5 47.4 275.7 35.8C278.9 24.2 277.8 4.4 287.2 -5.2C296.6 -14.8 324.4 -59.8 331.9 -21.6C339.3 16.6 337.2 188.5 331.9 224C326.6 259.5 306.9 200.6 300 191.3C293.1 182.0 294.1 172.8 290.4 168.4C286.7 164.0 282.5 164.7 277.7 165.1C272.9 165.5 266.0 170.8 261.7 170.8C257.4 170.8 255.3 167.6 252.1 165.1C248.9 162.6 245.0 158.1 242.6 156.1C240.2 154.1 240.7 152.5 237.4 152.9C234.1 153.3 228.9 157.3 222.8 158.6C216.8 159.9 207.9 159.9 201.1 161C194.3 162.1 186.7 162.8 181.9 165.1C177.1 167.4 173.7 170.5 172.3 174.9C170.9 179.3 172.5 183.1 173.6 191.3C174.7 199.5 216.1 218.6 178.7 224C141.3 229.4 -12.8 264.9 -51.1 224C-89.4 183.1 -65.8 19.3 -51.1 -21.6Z" fill="var(--map-water)" />

      <g fontSize="6.5" fontStyle="italic" style={LABEL} letterSpacing="0.06em">
        <text x="16" y="186">Atlantic Ocean</text>
        <text x="186" y="155.5">Tagus</text>
      </g>
      <g fontSize="7.2" style={{ ...LABEL, ...HALO }}>
        <text x="95.6" y="58.5" fontWeight="600">Sintra</text>
        <text x="62.9" y="137" textAnchor="middle">Cascais</text>
        <text x="17.3" y="78.4" fontSize="5.6">Cabo da Roca</text>
        <text x="227.1" y="173.8">Almada</text>
        <text x="242.6" y="126.0" textAnchor="end" fontWeight="700" fontSize="8.5">Lisbon</text>
      </g>

      {/* Rossio to Sintra by train, then up to the palace */}
      <path d="M241.6 130.9C239.0 128.3 232.0 119.7 226 115.2C220.0 110.7 212.4 107.2 205.5 103.8C198.6 100.4 190.5 96.1 184.5 94.8C178.5 93.5 176.9 97.1 169.4 95.7C161.9 94.3 147.4 88.7 139.5 86.6C131.6 84.5 126.6 84.9 121.9 83.3C117.2 81.7 114.9 80.5 111.1 76.8C107.3 73.1 102.5 63.9 98.9 61.2C95.3 58.5 91.1 60.6 89.6 60.5" fill="none" stroke="var(--map-land)" strokeWidth="5" strokeLinecap="round" />
      <path d="M241.6 130.9C239.0 128.3 232.0 119.7 226 115.2C220.0 110.7 212.4 107.2 205.5 103.8C198.6 100.4 190.5 96.1 184.5 94.8C178.5 93.5 176.9 97.1 169.4 95.7C161.9 94.3 147.4 88.7 139.5 86.6C131.6 84.5 126.6 84.9 121.9 83.3C117.2 81.7 114.9 80.5 111.1 76.8C107.3 73.1 102.5 63.9 98.9 61.2C95.3 58.5 91.1 60.6 89.6 60.5" fill="none" stroke="var(--map-route)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M89.6 60.5C88.8 61.4 86.1 64.4 84.9 66.1C83.7 67.8 83.0 69.8 82.6 70.5" fill="none" stroke="var(--map-route)" strokeWidth="1.8" strokeDasharray="2 2.2" strokeLinecap="round" />
      <text x="150" y="91" textAnchor="middle" fontSize="6.2" style={{ ...LABEL, ...HALO }}>
        Train, 40 min
      </text>
      <Pin x={82.6} y={70.5} label="2" />

      {/* Central Lisbon, where the other three stops are */}
      <line x1="248.6" y1="132" x2="248.6" y2="92" stroke="var(--map-label)" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
      <circle cx="248.6" cy="132" r="3.4" fill="var(--map-land)" stroke="var(--map-route)" strokeWidth="1.6" />
      <g transform="translate(172 8)">
        <rect width="120" height="84" rx="7" fill="var(--map-land)" style={{ filter: "drop-shadow(0 3px 6px rgb(0 0 0 / 0.18))" }} />
        <g clipPath="url(#ldm-inset)">
          <path d="M-31.9 126.3 L-31.9 93.6 L0.1 90.8 L40.5 79.9 L64 69.7 L96 59.4 L114.6 45.8 L133.3 30.7 L154.6 13.7 L181.2 13.7 L181.2 126.3Z" fill="var(--map-water)" />
          <path d="M42.7 17.1 L58.7 11.6 L72 13.7 L75.7 30.7 L74.7 40.3 L65.1 52.6 L56 58.7 L37.4 64.9 L21.4 68.3" fill="none" stroke="var(--travel)" strokeWidth="1.6" strokeDasharray="3 1.6" strokeLinecap="round" />
          <text x="53" y="28.4" textAnchor="end" fontSize="5.4" style={{ ...LABEL, ...HALO }}>Castelo</text>
          <text x="26" y="60.6" fontSize="5.4" style={{ ...LABEL, ...HALO }}>Baixa</text>
          <text x="82.7" y="34.3" fontSize="5.4" fontWeight="600" style={{ fill: "var(--travel-ink)", ...HALO }}>Tram 28</text>
          <path d="M66.1 51.9 L74.7 40.3" stroke="var(--map-route)" strokeWidth="1.6" strokeLinecap="round" />
          <Pin x={66.1} y={51.9} label="◆" stay />
          <Pin x={74.7} y={40.3} label="1" />
          <Pin x={47.5} y={18.4} label="3" />
          <g transform="translate(81.3 77)" style={LABEL}>
            <path d="M0 0 H30.7" stroke="var(--map-label)" strokeWidth="1" />
            <text x="15.35" y="-2" textAnchor="middle" fontSize="5">500 m</text>
          </g>
        </g>
        <rect width="120" height="84" rx="7" fill="none" stroke="var(--map-street)" strokeWidth="1" />
        <text x="7" y="10" fontSize="5.4" fontWeight="600" letterSpacing="0.08em" style={{ ...LABEL, ...HALO }}>CENTRAL LISBON</text>
      </g>
    </svg>
  );
}

/** Card size: the walk in central Lisbon, to scale. */
export function LisbonWalkMap({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 100" className={className} role="img" aria-label="Map of central Lisbon: Memmo Alfama, Tram 28 at Portas do Sol, and Mouraria, in the order you'll visit them" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="100" fill="var(--map-land)" />
      <path d="M-18.5 206 L-18.5 148.4 L37.6 143.6 L108.8 124.4 L150 106.4 L206.2 88.4 L239 64.4 L271.7 38 L309.2 8 L449.6 8 L449.6 206Z" fill="var(--map-water)" />
      <path d="M84.5 -7.6 L112.5 14 L140.6 4.4 L164 8 L170.6 38 L168.7 54.8 L151.9 76.4 L136 87.2 L103.2 98 L56.4 104" fill="none" stroke="var(--travel)" strokeWidth="2.4" strokeDasharray="5 2.5" strokeLinecap="round" />
      <text x="130" y="41.2" textAnchor="end" fontSize="7" style={{ ...LABEL, ...HALO }}>Castelo</text>
      <path d="M153.7 75.2 L168.7 54.8" stroke="var(--map-route)" strokeWidth="3" strokeLinecap="round" />
      <path d="M168.7 54.8 L121 16.4" stroke="var(--map-route)" strokeWidth="2.2" strokeDasharray="3 3" strokeLinecap="round" fill="none" />
      <Pin x={153.7} y={75.2} label="◆" stay r={9} />
      <Pin x={168.7} y={54.8} label="1" r={9} />
      <Pin x={121} y={16.4} label="3" r={9} />
    </svg>
  );
}
