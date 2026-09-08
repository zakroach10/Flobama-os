import { NextResponse } from "next/server";

const SCRIPT = `(() => {
  function findFrame() {
    return Array.from(document.querySelectorAll("iframe")).find((frame) =>
      (frame.getAttribute("src") || "").includes("/embed/events"),
    );
  }
  window.addEventListener("message", (event) => {
    if (!event.data || event.data.source !== "flobama-embed") return;
    const frame = findFrame();
    if (!frame || typeof event.data.height !== "number") return;
    frame.style.height = Math.max(640, event.data.height) + "px";
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
