import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canConfigureCameraConnector, canOperateCameras } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CAMERA_CONNECTOR_SQL, CAMERA_INVENTORY_SQL } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import {
  listActiveCameraLeases,
  listCameraDevices,
  listCameraInventory,
  listCameraSources,
} from "@/lib/queries/cameras";
import { CamerasWorkspace } from "@/components/cameras/cameras-workspace";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login?next=/cameras");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login?next=/cameras");

  const [devicesRes, camerasRes, inventoryRes, leasesRes] = await Promise.all([
    listCameraDevices(supabase, context.venue.id),
    listCameraSources(supabase, context.venue.id),
    listCameraInventory(supabase, context.venue.id),
    listActiveCameraLeases(supabase, context.venue.id),
  ]);

  if (devicesRes.missingTable || camerasRes.missingTable || leasesRes.missingTable) {
    return (
      <ErrorState
        title="Could not load cameras"
        description={`Apply ${CAMERA_CONNECTOR_SQL} in the Supabase SQL editor, then reload Cameras.`}
      />
    );
  }
  if (inventoryRes.missingTable) {
    return (
      <ErrorState
        title="Camera setup needs a database update"
        description={`Apply ${CAMERA_INVENTORY_SQL} in the Supabase SQL editor, then reload Cameras.`}
      />
    );
  }
  if (devicesRes.error) return <ErrorState title="Could not load Mac connector" description={devicesRes.error} />;
  if (camerasRes.error) return <ErrorState title="Could not load cameras" description={camerasRes.error} />;
  if (inventoryRes.error) return <ErrorState title="Could not load camera setup" description={inventoryRes.error} />;
  if (leasesRes.error) return <ErrorState title="Could not load control leases" description={leasesRes.error} />;

  return (
    <CamerasWorkspace
      devices={devicesRes.devices}
      cameras={camerasRes.cameras}
      inventory={inventoryRes.inventory}
      leases={leasesRes.leases}
      currentUserId={context.userId}
      canOperate={canOperateCameras(context.role)}
      canConfigure={canConfigureCameraConnector(context.role)}
      apiBase={getPublicAppUrl() ?? ""}
    />
  );
}
