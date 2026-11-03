import { handleCreateEvent, handleListEvents } from "@/lib/integrations/service";
import { productionRuntime } from "@/lib/integrations/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleListEvents(request, productionRuntime());
}

export async function POST(request: Request) {
  return handleCreateEvent(request, productionRuntime());
}
