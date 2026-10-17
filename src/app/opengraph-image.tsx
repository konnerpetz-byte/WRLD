import { ImageResponse } from "next/og";

export const alt = "WRLD: the dream trip, on a budget the whole group can do.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview people see when the site is shared in a group chat. */
export default function OpengraphImage() {
  const bubble = (text: string, me = false) => (
    <div
      style={{
        alignSelf: me ? "flex-end" : "flex-start",
        background: me ? "#2f6bff" : "#e3e9e5",
        color: me ? "#fff" : "#10231d",
        borderRadius: 28,
        padding: "14px 22px",
        fontSize: 26,
        display: "flex",
        marginTop: 14,
      }}
    >
      {text}
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3f7f4", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "#0f3d33" }}>WRLD</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.02, color: "#10231d", letterSpacing: -2 }}>The dream trip, on a budget everyone can do.</div>
            <div style={{ fontSize: 30, color: "#4e5f58", marginTop: 24, lineHeight: 1.3 }}>Where your money goes furthest. Official ticket prices. A fair split.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 48, flex: 1 }}>
          {bubble("Lisbon? if it's under $1,200")}
          {bubble("WRLD found it for $1,140 each", true)}
          {bubble("wait HOW")}
          <div style={{ display: "flex", marginTop: 26, background: "#0f3d33", borderRadius: 28, overflow: "hidden", flexDirection: "column" }}>
            <div style={{ color: "#f4f8f5", fontSize: 28, padding: "22px 26px", display: "flex" }}>Going in May: saves $210 each</div>
            <div style={{ background: "#ffc83d", color: "#362700", fontSize: 28, fontWeight: 700, padding: "18px 26px", display: "flex" }}>Official tickets: saves $46 each</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
