import { NextResponse } from "next/server";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { runLedWallAutomation } from "@/lib/screens/led-wall-automation";
import { isLedCronAuthorized } from "@/lib/screens/led-wall-cron";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLedCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role is not configured." }, { status: 503 });
  }

  try {
    const result = await runLedWallAutomation(admin, FLO_BAMA_VENUE_ID, new Date());
    if (result.adRollReset || result.artistAutoActivated.length > 0) {
      revalidatePath("/screens");
      revalidatePath("/display/led");
      revalidatePath("/api/public/v1/screens/led");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LED wall automation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
