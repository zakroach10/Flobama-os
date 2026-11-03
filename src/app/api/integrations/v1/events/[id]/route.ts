import { handleGetEvent, handlePatchEvent } from "@/lib/integrations/service";
import { productionRuntime } from "@/lib/integrations/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleGetEvent(request, id, productionRuntime());
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handlePatchEvent(request, id, productionRuntime());
}
