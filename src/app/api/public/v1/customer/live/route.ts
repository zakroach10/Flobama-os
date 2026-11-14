import { customerJson, customerOptions } from "@/lib/customer/http";
import { getLiveState, muxEnvFromProcess } from "@/lib/customer/stream";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET() {
  const live = await getLiveState(muxEnvFromProcess());
  return customerJson({ live });
}
