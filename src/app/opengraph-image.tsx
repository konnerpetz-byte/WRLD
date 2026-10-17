import { ImageResponse } from "next/og";

export const alt = "WRLD: from group chat to booked. Plan together and split it fairly, even when someone pays in miles.";
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
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, color: "#10231d", letterSpacing: -2 }}>From group chat to booked.</div>
            <div style={{ fontSize: 30, color: "#4e5f58", marginTop: 24, lineHeight: 1.3 }}>Plan together. Split it fairly, even when someone pays in miles.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 48, flex: 1 }}>
          {bubble("ok are we doing Lisbon?")}
          {bubble("I'll cover flights with miles", true)}
          {bubble("how do we pay you back?")}
          <div style={{ display: "flex", marginTop: 26, background: "#0f3d33", borderRadius: 28, overflow: "hidden", flexDirection: "column" }}>
            <div style={{ color: "#f4f8f5", fontSize: 28, padding: "22px 26px", display: "flex" }}>120,000 miles at 1.2¢ = $1,440</div>
            <div style={{ background: "#ffc83d", color: "#362700", fontSize: 28, fontWeight: 700, padding: "18px 26px", display: "flex" }}>Each friend owes you $360</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
