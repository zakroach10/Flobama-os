import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { WallPhoneUploadForm } from "@/components/screens/wall-phone-upload-form";
import { getPublicSupabaseEnv } from "@/lib/env";
import { wallOpsPwaMetadata, WALL_OPS_PWA_THEME_COLOR } from "@/lib/pwa/wall-ops";
import { verifyWallLedUploadToken } from "@/lib/screens/wall-upload-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...wallOpsPwaMetadata,
  title: "Upload wall scene",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: WALL_OPS_PWA_THEME_COLOR,
  colorScheme: "dark",
};

export default async function WallPhoneUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const params = await searchParams;
  const verified = verifyWallLedUploadToken(params.t);
  const supabaseEnv = getPublicSupabaseEnv();

  return (
    <div className="dark min-h-dvh bg-[radial-gradient(ellipse_at_top,_rgba(196,86,48,0.14),_transparent_55%),linear-gradient(180deg,_#141210_0%,_#1c1916_45%,_#12100e_100%)] text-foreground">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
        <FlobamaLogo className="h-8 w-auto max-w-[150px] brightness-110" priority />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Upload a wall scene</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Send an MP4 loop or PNG still to FloBama Screens. No staff login needed on this phone.
        </p>

        <div className="mt-8 rounded-2xl border border-border/70 bg-card/80 p-4">
          {verified.ok && params.t ? (
            <WallPhoneUploadForm token={params.t} supabaseEnv={supabaseEnv} />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-amber-100">{verified.ok ? "Upload link is missing." : verified.message}</p>
              <p className="text-muted-foreground">
                On the venue computer, open FloBama Screens → Upload → Show phone QR, then scan again.
              </p>
              <Link href="/wall" className="inline-flex min-h-11 items-center text-foreground underline-offset-4 hover:underline">
                Open wall sign-in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
