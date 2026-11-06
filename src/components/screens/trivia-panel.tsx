"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  endTriviaAction,
  importTriviaCsvAction,
  startTriviaAction,
  updateTriviaPackBrandAction,
} from "@/actions/trivia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRIVIA_CSV_TEMPLATE } from "@/lib/trivia/csv";
import { DEFAULT_TRIVIA_BRAND, type TriviaPackBrand } from "@/lib/trivia/brand";
import type { TriviaPackSummary, TriviaStaffSession } from "@/lib/trivia/types";
import {
  TRIVIA_DEFAULT_LOBBY_SECONDS,
  TRIVIA_DEFAULT_QUESTION_COUNT,
  TRIVIA_DEFAULT_QUESTION_SECONDS,
} from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function brandDraftFromPack(pack: TriviaPackSummary | undefined): TriviaPackBrand {
  return pack?.brand ?? DEFAULT_TRIVIA_BRAND;
}

export function TriviaPanel({
  packs,
  session,
  missingTable,
  canConfigure,
  joinBaseUrl,
  venueId,
  supabaseEnv,
}: {
  packs: TriviaPackSummary[];
  session: TriviaStaffSession | null;
  missingTable: boolean;
  canConfigure: boolean;
  joinBaseUrl: string;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const [questionCount, setQuestionCount] = useState(String(TRIVIA_DEFAULT_QUESTION_COUNT));
  const [lobbySeconds, setLobbySeconds] = useState(String(TRIVIA_DEFAULT_LOBBY_SECONDS));
  const [csvText, setCsvText] = useState("");
  const selectedPack = useMemo(() => packs.find((pack) => pack.id === packId), [packs, packId]);
  const [brand, setBrand] = useState<TriviaPackBrand>(() => brandDraftFromPack(selectedPack));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setBrand(brandDraftFromPack(selectedPack));
    setLogoFile(null);
  }, [selectedPack]);

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Trivia</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">supabase/migrations/20260929000012_trivia.sql</code> in Supabase, then reload.
        </p>
      </section>
    );
  }

  function start() {
    startTransition(async () => {
      const result = await startTriviaAction({
        packId,
        questionCount: Number.parseInt(questionCount, 10) || TRIVIA_DEFAULT_QUESTION_COUNT,
        lobbySeconds: Number.parseInt(lobbySeconds, 10) || TRIVIA_DEFAULT_LOBBY_SECONDS,
        questionSeconds: TRIVIA_DEFAULT_QUESTION_SECONDS,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function end() {
    startTransition(async () => {
      const result = await endTriviaAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function importCsv() {
    startTransition(async () => {
      const result = await importTriviaCsvAction({
        packId,
        csvText,
        replace: true,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setCsvText("");
      router.refresh();
    });
  }

  function saveBrand(clearLogo = false) {
    startTransition(async () => {
      let logoPath: string | null | undefined;
      let logoUrl: string | null | undefined;

      if (clearLogo) {
        logoPath = null;
        logoUrl = null;
      } else if (logoFile) {
        if (!supabaseEnv) {
          toast.error("Supabase is not configured in this deployment.");
          return;
        }
        const supabase = createBrowserSupabaseClient(supabaseEnv);
        if (!supabase) {
          toast.error("Supabase is not configured in this deployment.");
          return;
        }
        setUploadingLogo(true);
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${venueId}/trivia/${packId}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("screen-ads").upload(path, logoFile, {
          contentType: logoFile.type || "image/png",
          upsert: false,
          cacheControl: "86400",
        });
        setUploadingLogo(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        logoPath = path;
        logoUrl = supabase.storage.from("screen-ads").getPublicUrl(path).data.publicUrl;
      }

      const result = await updateTriviaPackBrandAction({
        packId,
        background: brand.background,
        text: brand.text,
        accent: brand.accent,
        muted: brand.muted,
        mutedStrong: brand.mutedStrong,
        ...(logoPath !== undefined ? { logoPath, logoUrl: logoUrl ?? null } : {}),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setLogoFile(null);
      router.refresh();
    });
  }

  const busy = pending || uploadingLogo;

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Trivia</h2>
          <p className="text-sm text-muted-foreground">
            Activate an automatic Shoals music history game. LED wall shows QR join, rounds, top 3 teases, and the final
            board. Vertical kiosks hold a join promo while live.
          </p>
        </div>

        {session ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">
              Live · {session.packTitle} · {session.status} · Q{session.currentQuestionIndex + 1}/
              {session.questionCount}
            </p>
            <p className="text-sm text-muted-foreground">
              Code <span className="font-semibold text-foreground">{session.joinCode}</span> · {session.playerCount}{" "}
              players · {joinBaseUrl}/{session.joinCode}
            </p>
            <Button type="button" variant="destructive" disabled={busy} onClick={end}>
              End trivia
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="trivia-pack">Question pack</Label>
              <select
                id="trivia-pack"
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={packId}
                onChange={(event) => setPackId(event.target.value)}
              >
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.title} ({pack.questionCount} questions)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trivia-count">Questions</Label>
              <Input
                id="trivia-count"
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trivia-lobby">Lobby seconds</Label>
              <Input
                id="trivia-lobby"
                type="number"
                min={15}
                max={600}
                value={lobbySeconds}
                onChange={(event) => setLobbySeconds(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" disabled={busy || !packId || packs.length === 0} onClick={start}>
                {pending ? "Starting…" : "Start trivia"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {canConfigure ? (
        <>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div>
              <h3 className="text-base font-semibold">Pack branding</h3>
              <p className="text-sm text-muted-foreground">
                Colors and optional logo for the selected pack (wall, kiosk, and phone play). Defaults match FloBama warm
                trivia.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["background", "Background"],
                  ["text", "Text"],
                  ["accent", "Accent"],
                  ["muted", "Muted"],
                  ["mutedStrong", "Muted strong"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`trivia-brand-${key}`}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`trivia-brand-${key}`}
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded border bg-background"
                      value={brand[key]}
                      onChange={(event) => setBrand((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                    <Input
                      value={brand[key]}
                      onChange={(event) => setBrand((prev) => ({ ...prev, [key]: event.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trivia-brand-logo">Logo (PNG/JPEG, optional)</Label>
              <Input
                id="trivia-brand-logo"
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                disabled={busy || !packId}
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              />
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="mt-2 h-12 w-auto max-w-[200px] object-contain" />
              ) : null}
            </div>
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                background: brand.background,
                color: brand.text,
              }}
            >
              <p style={{ color: brand.accent }} className="text-xs font-semibold tracking-[0.2em] uppercase">
                Preview
              </p>
              <p className="mt-1 text-lg font-bold">{selectedPack?.title ?? "Pack"}</p>
              <p style={{ color: brand.muted }}>{selectedPack?.theme ?? "Theme"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !packId} onClick={() => saveBrand(false)}>
                {uploadingLogo ? "Uploading…" : "Save branding"}
              </Button>
              {brand.logoUrl ? (
                <Button type="button" variant="outline" disabled={busy || !packId} onClick={() => saveBrand(true)}>
                  Clear logo
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div>
              <h3 className="text-base font-semibold">Upload spreadsheet</h3>
              <p className="text-sm text-muted-foreground">
                CSV headers: <code className="text-xs">question,a,b,c,d,correct,points</code>. Correct is A–D. Replaces
                the selected pack. Template samples use mixed B/C/D answers.
              </p>
            </div>
            <textarea
              className="min-h-40 w-full rounded-md border bg-background p-3 font-mono text-xs"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={TRIVIA_CSV_TEMPLATE}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !csvText.trim() || !packId} onClick={importCsv}>
                Import CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCsvText(TRIVIA_CSV_TEMPLATE);
                }}
              >
                Load template
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
