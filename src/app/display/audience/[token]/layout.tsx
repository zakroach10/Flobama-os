import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Audience wall",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07090d",
};

export default function AudienceObsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent text-white">
      <style>{`
        html, body {
          margin: 0;
          height: 100%;
          overflow: hidden !important;
          background: transparent !important;
        }
      `}</style>
      {children}
    </div>
  );
}
