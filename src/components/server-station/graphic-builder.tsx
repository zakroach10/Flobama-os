"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CakeIcon, HeartIcon, PartyPopperIcon, SparklesIcon, UtensilsCrossedIcon, WineIcon } from "lucide-react";
import { toast } from "sonner";
import {
  issueServerStationUploadSessionAction,
  pollServerStationUploadSessionAction,
  publishServerStationGraphicAction,
} from "@/actions/server-station";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import { renderServerStationGraphicBlob } from "@/lib/server-station/graphics";
import { durationPresetLabel, type ServerStationDurationPreset } from "@/lib/server-station/expiration";
import {
  SERVER_STATION_TEMPLATES,
  type ServerStationGraphicKind,
  type ServerStationTemplateId,
} from "@/lib/server-station/templates";
import { detectServerStationUploadKind } from "@/lib/server-station/upload-kinds";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PublicSupabaseEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

const DURATION_OPTIONS: ServerStationDurationPreset[] = [5, 15, 30, "tonight"];

export function ServerStationGraphicBuilder({
  actorName,
  wall,
  mode,
  venueId,
  supabaseEnv,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  mode: "special" | "birthday" | "message";
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [category, setCategory] = useState<"food_special" | "drink_special">("drink_special");
  const [celebration, setCelebration] = useState<"birthday" | "anniversary" | "congratulations" | "celebration">(
    "birthday",
  );
  const [headline, setHeadline] = useState(mode === "birthday" ? "JESSICA" : "");
  const [subtitle, setSubtitle] = useState(mode === "special" ? "Tonight Only" : "");
  const [price, setPrice] = useState("");
  const [templateId, setTemplateId] = useState<ServerStationTemplateId>(SERVER_STATION_TEMPLATES[0].id);
  const [duration, setDuration] = useState<ServerStationDurationPreset>(mode === "special" ? "tonight" : 5);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [localPhotoName, setLocalPhotoName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrlRef = useRef<string | null>(null);

  function clearLocalPhotoObjectUrl() {
    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current);
      localObjectUrlRef.current = null;
    }
  }

  function clearPhoto() {
    clearLocalPhotoObjectUrl();
    setPhotoUrl(null);
    setLocalPhotoName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onChooseLocalPhoto(file: File | null) {
    if (!file) return;
    const kind = detectServerStationUploadKind(file);
    if (kind !== "image") {
      toast.error("Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be 10 MB or smaller.");
      return;
    }
    clearLocalPhotoObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    localObjectUrlRef.current = objectUrl;
    setPhotoUrl(objectUrl);
    setLocalPhotoName(file.name);
    setUploadSessionId(null);
    setQrDataUrl(null);
    toast.success("Photo added. Check the preview.");
  }

  useEffect(() => {
    return () => {
      clearLocalPhotoObjectUrl();
    };
  }, []);

  const kind: ServerStationGraphicKind = useMemo(() => {
    if (mode === "special") return category;
    if (mode === "birthday") {
      if (celebration === "birthday") return "birthday";
      if (celebration === "anniversary") return "anniversary";
      if (celebration === "congratulations") return "congratulations";
      return "celebration";
    }
    return "message";
  }, [mode, category, celebration]);

  const title =
    mode === "special" ? "Food & Drink Specials" : mode === "birthday" ? "Birthday Screen" : "Custom Message";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const blob = await renderServerStationGraphicBlob({
            kind,
            templateId,
            headline: headline || (mode === "birthday" ? "GUEST" : "Your message"),
            subtitle: subtitle || null,
            price: price || null,
            photoUrl,
            footer: mode === "birthday" ? "FROM YOUR FRIENDS AT FLOBAMA" : "FLOBAMA MUSIC HALL",
          });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });
        } catch {
          // Preview failures should not block the form.
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, templateId, headline, subtitle, price, photoUrl, mode]);

  useEffect(() => {
    if (!uploadSessionId) return;
    const timer = setInterval(() => {
      void (async () => {
        const result = await pollServerStationUploadSessionAction({ sessionId: uploadSessionId });
        if (result.ok && result.uploaded && result.url) {
          clearLocalPhotoObjectUrl();
          setLocalPhotoName(null);
          setPhotoUrl(result.url);
          setUploadSessionId(null);
          setQrDataUrl(null);
          toast.success("Photo received from phone.");
        }
      })();
    }, 2500);
    return () => clearInterval(timer);
  }, [uploadSessionId]);

  async function uploadGraphicAndPublish(publishMode: "show_now" | "add_rotation") {
    if (!headline.trim()) {
      toast.error(mode === "birthday" ? "Enter the guest’s name." : "Enter a headline.");
      return;
    }
    startTransition(async () => {
      try {
        const blob = await renderServerStationGraphicBlob({
          kind,
          templateId,
          headline: headline.trim(),
          subtitle: subtitle.trim() || null,
          price: price.trim() || null,
          photoUrl,
          footer: mode === "birthday" ? "FROM YOUR FRIENDS AT FLOBAMA" : "FLOBAMA MUSIC HALL",
        });
        const supabase = createBrowserSupabaseClient(supabaseEnv);
        if (!supabase) {
          toast.error("Upload is not configured on this deployment.");
          return;
        }
        const id = crypto.randomUUID();
        const storagePath = `${venueId}/led/server-${id}.png`;
        const file = new File([blob], `server-${id}.png`, { type: "image/png" });
        let contentHash: string | undefined;
        try {
          const { sha256HexFromBlob } = await import("@/lib/display-devices/hashes");
          contentHash = await sha256HexFromBlob(file);
        } catch {
          contentHash = undefined;
        }
        const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, file, {
          contentType: "image/png",
          upsert: false,
        });
        if (uploadError) {
          toast.error(uploadError.message);
          return;
        }
        const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
        const result = await publishServerStationGraphicAction({
          kind: mode === "birthday" ? (celebration === "birthday" ? "birthday" : "celebration") : mode === "special" ? category : "message",
          celebrationType: mode === "birthday" ? celebration : undefined,
          title: headline.trim(),
          subtitle: subtitle.trim() || null,
          price: price.trim() || null,
          templateId,
          publicUrl,
          storagePath,
          contentHash,
          durationPreset: duration,
          mode: publishMode,
          photoUrl,
        });
        setResultMessage(result.message);
        setResultOk(result.ok);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not create the graphic.");
      }
    });
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title={title}>
      <div className="mb-5 space-y-2">
        <h1 className="text-3xl font-bold text-[#f7efe6]">{title}</h1>
        <p className="text-lg text-[#e8d5c4]/90">
          Fill in the basics, check the preview, then put it on the wall.
        </p>
      </div>

      {resultMessage ? (
        <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          <p>{resultMessage}</p>
          {resultOk ? (
            <Link href="/server/active" className="mt-3 inline-flex min-h-12 items-center text-base font-semibold underline">
              See your rotation
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {mode === "special" ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["drink_special", "Drink Special", WineIcon],
                  ["food_special", "Food Special", UtensilsCrossedIcon],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={cn(
                    "inline-flex min-h-14 items-center gap-2 rounded-2xl px-5 text-base font-semibold",
                    category === id ? "bg-[#d36b4a] text-white" : "border border-white/15 bg-white/5",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {mode === "birthday" ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["birthday", "Happy Birthday", CakeIcon],
                  ["anniversary", "Happy Anniversary", HeartIcon],
                  ["congratulations", "Congratulations", PartyPopperIcon],
                  ["celebration", "Custom Celebration", SparklesIcon],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCelebration(id)}
                  className={cn(
                    "inline-flex min-h-14 items-center gap-2 rounded-2xl px-5 text-base font-semibold",
                    celebration === id ? "bg-[#d36b4a] text-white" : "border border-white/15 bg-white/5",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <ServerStationField label={mode === "birthday" ? "Guest first name" : mode === "special" ? "Item name" : "Headline"}>
            <input
              className={serverStationInputClass}
              value={headline}
              maxLength={mode === "birthday" ? 24 : 48}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder={mode === "birthday" ? "Jessica" : mode === "special" ? "Margaritas" : "Welcome UNA Alumni!"}
            />
          </ServerStationField>

          {mode === "special" ? (
            <ServerStationField label="Price (optional)">
              <input
                className={serverStationInputClass}
                value={price}
                maxLength={24}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="$5"
              />
            </ServerStationField>
          ) : null}

          <ServerStationField label={mode === "message" ? "Subtitle (optional)" : "Short note (optional)"}>
            <input
              className={serverStationInputClass}
              value={subtitle}
              maxLength={72}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder={mode === "special" ? "Tonight Only" : "Optional second line"}
            />
          </ServerStationField>

          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Template</p>
            <div className="grid grid-cols-2 gap-2">
              {SERVER_STATION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={cn(
                    "min-h-16 rounded-2xl border px-4 text-left text-base font-semibold",
                    templateId === template.id ? "border-[#d36b4a] bg-[#d36b4a]/20" : "border-white/15 bg-black/20",
                  )}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">How long</p>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  onClick={() => setDuration(option)}
                  className={cn(
                    "min-h-14 rounded-2xl px-4 text-base font-semibold",
                    duration === option ? "bg-[#d36b4a] text-white" : "border border-white/15 bg-white/5",
                  )}
                >
                  {durationPresetLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Photo (optional)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(event) => {
                onChooseLocalPhoto(event.target.files?.[0] ?? null);
              }}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <ServerStationButton
                variant="secondary"
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose photo from this device
              </ServerStationButton>
              <ServerStationButton
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await issueServerStationUploadSessionAction({
                      workflow: mode === "special" ? "special" : mode === "birthday" ? "birthday" : "message",
                    });
                    if (!result.ok || !result.uploadUrl || !result.sessionId) {
                      toast.error(result.message);
                      return;
                    }
                    setUploadSessionId(result.sessionId);
                    const dataUrl = await QRCode.toDataURL(result.uploadUrl, {
                      width: 512,
                      margin: 1,
                      color: { dark: "#1a1410", light: "#ffffff" },
                    });
                    setQrDataUrl(dataUrl);
                    toast.success(result.message);
                  });
                }}
              >
                Add photo from phone
              </ServerStationButton>
              {photoUrl ? (
                <ServerStationButton variant="secondary" onClick={clearPhoto}>
                  Remove photo
                </ServerStationButton>
              ) : null}
            </div>
            {localPhotoName ? (
              <p className="text-sm text-[#e8d5c4]">Selected: {localPhotoName}</p>
            ) : null}
            {photoUrl && !qrDataUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Selected photo" className="max-h-48 w-full object-contain" />
              </div>
            ) : null}
          </div>

          {qrDataUrl ? (
            <div className="rounded-2xl border border-white/10 bg-white p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Upload QR code" className="mx-auto h-56 w-56" />
              <p className="mt-2 text-sm font-medium text-[#1a1410]">Scan with your phone to upload a picture.</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <ServerStationButton disabled={pending} onClick={() => void uploadGraphicAndPublish("show_now")}>
              Show Now
            </ServerStationButton>
            <ServerStationButton
              variant="secondary"
              disabled={pending}
              onClick={() => void uploadGraphicAndPublish("add_rotation")}
            >
              Add to LED Rotation
            </ServerStationButton>
          </div>
          <p className="text-sm text-[#e8d5c4]/80">
            The ad already playing finishes first. Show Now starts after that ad. Add to LED Rotation puts this
            slide next in line.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Preview</p>
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/40">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Wall preview" className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-[#e8d5c4]">Building preview…</div>
            )}
          </div>
          <p className="text-sm text-[#e8d5c4]/80">1920×1080 FloBama template — no design tools needed.</p>
        </div>
      </div>
    </ServerStationShell>
  );
}
