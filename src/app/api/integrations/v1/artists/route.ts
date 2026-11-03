import { handleListArtists } from "@/lib/integrations/service";
import { productionRuntime } from "@/lib/integrations/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListArtists(request, productionRuntime());
}
