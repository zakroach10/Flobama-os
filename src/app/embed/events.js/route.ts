import { NextResponse } from "next/server";

const SCRIPT = `(() => {
  function findFrames() {
    return Array.from(document.querySelectorAll("iframe")).filter((frame) => {
      const src = frame.getAttribute("src") || "";
      return src.includes("/embed/events") && !src.includes("/embed/events.js");
    });
  }
  window.addEventListener("message", (event) => {
    if (!event.data || event.data.source !== "flobama-embed") return;
    if (typeof event.data.height !== "number") return;
    for (const frame of findFrames()) {
      try {
        if (frame.contentWindow !== event.source) continue;
      } catch {
        // Cross-origin: still resize matching FloBama embeds.
      }
      frame.style.height = Math.max(640, event.data.height) + "px";
    }
  });
})();
`;

export function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
