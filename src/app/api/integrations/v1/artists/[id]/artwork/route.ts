import { handleCompleteArtwork } from "@/lib/integrations/service";
import { productionRuntime } from "@/lib/integrations/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleCompleteArtwork(request, id, productionRuntime());
}
