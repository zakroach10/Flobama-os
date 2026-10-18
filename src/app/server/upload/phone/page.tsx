import type { Metadata, Viewport } from "next";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { ServerStationPhoneUploadForm } from "@/components/server-station/phone-upload-form";
import { getPublicSupabaseEnv } from "@/lib/env";
import { resolveServerStationUploadSession } from "@/lib/server-station/phone-upload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload to Server Station",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#14110f",
  colorScheme: "dark",
};

export default async function ServerStationPhoneUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const params = await searchParams;
  const token = params.t ?? "";
  const verified = token
    ? await resolveServerStationUploadSession(token)
    : { ok: false as const, message: "Upload link is missing." };
  const supabaseEnv = getPublicSupabaseEnv();

  return (
    <div className="dark h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.16),_transparent_55%),linear-gradient(180deg,_#14110f_0%,_#1a1613_45%,_#100e0c_100%)] text-foreground">
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-8">
        <FlobamaLogo className="h-8 w-auto max-w-[150px] brightness-110" priority />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Upload a picture</h1>
        <p className="mt-2 text-sm text-[#e8d5c4]/90">
          No staff login needed on this phone. Choose a picture from your camera roll or files, then approve it on the Server Station.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4">
          {verified.ok ? (
            <ServerStationPhoneUploadForm token={token} supabaseEnv={supabaseEnv} />
          ) : (
            <p className="text-amber-100">{verified.message}</p>
          )}
        </div>
      </main>
    </div>
  );
}
