import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, "/dashboard");
  if (nextPath !== "/dashboard") {
    redirect(`/?next=${encodeURIComponent(nextPath)}`);
  }
  redirect("/");
}
