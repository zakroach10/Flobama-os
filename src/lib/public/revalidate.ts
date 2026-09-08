import { revalidatePath } from "next/cache";

export function revalidatePublicSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath("/artists");
  revalidatePath("/settings");
  revalidatePath("/booth");
  revalidatePath("/embed/events");
  revalidatePath("/overlay");
  revalidatePath("/api/public/v1/events");
  revalidatePath("/api/public/v1/now");
  revalidatePath("/screens");
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/screens/vertical");
}
