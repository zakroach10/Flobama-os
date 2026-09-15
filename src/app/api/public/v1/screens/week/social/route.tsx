import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import {
  socialGraphicFileName,
  weekSocialFormat,
  weekSocialPages,
} from "@/lib/screens/social";
import { WeekSocialOgGraphic } from "@/lib/screens/week-social-image";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = weekSocialFormat(url.searchParams.get("size"));
  const pageNumber = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const demo = process.env.NODE_ENV !== "production" && url.searchParams.get("demo") === "1";

  const week = demo ? DEMO_WEEK_SLIDE : await loadLiveWeek();
  if ("error" in week) return publicJson({ error: week.error }, week.status);

  const pages = weekSocialPages(week.days, format);
  const pageIndex = Math.min(pageNumber, pages.length) - 1;
  const days = pages[pageIndex] ?? [];
  const pageLabel = pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : null;
  const filename = socialGraphicFileName(week.rangeLabel, format.id, pageIndex + 1, pages.length);
  const [paperSrc, tearSrc, stickerSrc, regular, bold] = await Promise.all([
    fileDataUri("public/social/paper-orange.jpg", "image/jpeg"),
    fileDataUri("public/social/paper-tear.png", "image/png"),
    fileDataUri("public/flobama-logo.png", "image/png"),
    readFile(join(process.cwd(), "public/fonts/Roboto-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/Roboto-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <WeekSocialOgGraphic
          format={format}
          rangeLabel={week.rangeLabel}
          days={days}
          pageLabel={pageLabel}
          paperSrc={paperSrc}
          tearSrc={tearSrc}
          stickerSrc={stickerSrc}
        />
      </div>
    ),
    {
      width: format.width,
      height: format.height,
      fonts: [
        { name: "Roboto", data: regular, weight: 400, style: "normal" },
        { name: "Roboto", data: bold, weight: 700, style: "normal" },
      ],
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": PUBLIC_NO_STORE,
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

async function loadLiveWeek() {
  const client = createAnonSupabaseClient();
  if (!client) return { error: "Public listings are not configured.", status: 503 as const };
  const { events, error } = await listPublicWeekEvents(client, FLO_BAMA_VENUE_ID);
  if (error) return { error, status: 500 as const };
  return buildWeekSlidePayload(events);
}

async function fileDataUri(relativePath: string, mime: string) {
  try {
    const bytes = await readFile(join(process.cwd(), relativePath));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
