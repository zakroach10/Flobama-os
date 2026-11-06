"use client";

import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { DEFAULT_TRIVIA_BRAND, triviaBrandCssVars, type TriviaPackBrand } from "@/lib/trivia/brand";

export type TriviaKioskPromo = {
  joinCode: string;
  joinUrl: string;
  packTitle: string;
  playerCount: number;
  status: string;
  brand?: TriviaPackBrand;
};

export function TriviaKioskSlide({ promo }: { promo: TriviaKioskPromo }) {
  const [qr, setQr] = useState<string | null>(null);
  const brand = promo.brand ?? DEFAULT_TRIVIA_BRAND;

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(promo.joinUrl, {
      margin: 1,
      width: 640,
      color: { dark: brand.background, light: brand.text },
    }).then((src) => {
      if (!cancelled) setQr(src);
    });
    return () => {
      cancelled = true;
    };
  }, [promo.joinUrl, brand.background, brand.text]);

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between bg-[var(--trivia-bg)] px-16 py-20 text-center text-[var(--trivia-text)]"
      style={triviaBrandCssVars(brand) as CSSProperties}
    >
      <div className="space-y-6">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            className="mx-auto h-24 w-auto max-w-[420px] object-contain"
          />
        ) : null}
        <p className="text-[34px] font-semibold tracking-[0.28em] text-[var(--trivia-accent)] uppercase">
          Live trivia
        </p>
        <h2 className="text-[64px] leading-none font-black tracking-tight">{promo.packTitle}</h2>
        <p className="text-[34px] text-[var(--trivia-muted)]">Scan to join on your phone</p>
      </div>
      <div className="flex w-full max-w-[760px] flex-col items-center gap-10">
        <div className="aspect-square w-full max-w-[640px] rounded-[48px] bg-[var(--trivia-text)] p-10">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Join trivia QR code" className="h-full w-full object-contain" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-[32px] bg-[color-mix(in_srgb,var(--trivia-muted)_55%,white)]" />
          )}
        </div>
        <p className="text-[72px] font-black tracking-[0.2em]">{promo.joinCode}</p>
        <p className="text-[32px] text-[var(--trivia-muted-strong)]">
          {promo.playerCount} joined · {promo.status}
        </p>
      </div>
    </div>
  );
}
