import { revalidatePath } from "next/cache";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { IntegrationDeps } from "@/lib/integrations/service";
import { SupabaseIntegrationStore } from "@/lib/integrations/supabase-store";
import { UnconfiguredIntegrationStore } from "@/lib/integrations/memory-store";

export function productionRuntime(): IntegrationDeps {
  const admin = createServiceRoleClient();
  if (!admin) return { store: new UnconfiguredIntegrationStore() };
  return {
    store: new SupabaseIntegrationStore(admin),
    revalidateEvent: (eventId) => {
      revalidatePublicSurfaces();
      revalidatePath(`/programming/${eventId}`);
      revalidatePath(`/programming/${eventId}/edit`);
    },
    revalidateArtwork: (artistId) => {
      revalidatePath("/screens");
      revalidatePath("/artists");
      revalidatePath(`/artists/${artistId}`);
      revalidatePath("/display/led");
      revalidatePath("/api/public/v1/screens/led");
    },
  };
}
