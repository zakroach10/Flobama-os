"use client";

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
import { StationLink } from "@/components/server-station/station-nav";
import { renderServerStationGraphicBlob } from "@/lib/server-station/graphics";
import {
  BUILTIN_FOOD_PRESETS,
  formatFoodPrice,
  readExtraFoodPresets,
  writeExtraFoodPresets,
  type FoodWallPreset,
} from "@/lib/server-station/food-presets";
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
  const [category, setCategory] = useState<"food_special" | "drink_special">("food_special");
  const [foodComposer, setFoodComposer] = useState<"presets" | "custom">("presets");
  const [presetPage, setPresetPage] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(BUILTIN_FOOD_PRESETS[0]?.id ?? null);
  const [extraPresets, setExtraPresets] = useState<FoodWallPreset[]>([]);
  const [celebration, setCelebration] = useState<"birthday" | "anniversary" | "congratulations" | "celebration">(
    "birthday",
  );
  const openingPreset = mode === "special" ? BUILTIN_FOOD_PRESETS[0] : null;
  const [headline, setHeadline] = useState(mode === "birthday" ? "JESSICA" : openingPreset?.food ?? "");
  const [subtitle, setSubtitle] = useState(mode === "special" ? openingPreset?.promoMessage ?? "" : "");
  const [price, setPrice] = useState(openingPreset ? formatFoodPrice(openingPreset.price) : "");
  const [templateId, setTemplateId] = useState<ServerStationTemplateId>(SERVER_STATION_TEMPLATES[0].id);
  const [duration, setDuration] = useState<ServerStationDurationPreset>(mode === "special" ? "tonight" : 5);
  const [photoUrl, setPhotoUrl] = useState<string | null>(openingPreset?.imageUrl ?? null);
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
    setExtraPresets(readExtraFoodPresets());
    return () => {
      clearLocalPhotoObjectUrl();
    };
  }, []);

  const foodPresets = useMemo(() => [...BUILTIN_FOOD_PRESETS, ...extraPresets], [extraPresets]);

  function applyFoodPreset(preset: FoodWallPreset) {
    setSelectedPresetId(preset.id);
    setCategory("food_special");
    setFoodComposer("presets");
    setHeadline(preset.food);
    setPrice(formatFoodPrice(preset.price));
    setSubtitle(preset.promoMessage);
    clearLocalPhotoObjectUrl();
    setLocalPhotoName(null);
    setPhotoUrl(preset.imageUrl || null);
    setUploadSessionId(null);
    setQrDataUrl(null);
  }

  function saveCustomFoodPreset() {
    const name = headline.trim();
    if (!name) {
      toast.error("Enter the food name before saving it as a preset.");
      return;
    }
    const preset: FoodWallPreset = {
      id: `custom-${crypto.randomUUID()}`,
      food: name,
      price: price.trim().replace(/^\$/, ""),
      promoMessage: subtitle.trim(),
      imageUrl: photoUrl && /^https?:\/\//.test(photoUrl) ? photoUrl : "",
      custom: true,
    };
    const next = writeExtraFoodPresets([preset, ...extraPresets.filter((row) => row.food !== preset.food)]);
    setExtraPresets(next);
    setSelectedPresetId(preset.id);
    setFoodComposer("presets");
    toast.success(`${name} is on the preset list.`);
  }

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

  if (mode === "special" && category === "food_special" && foodComposer === "presets") {
    return (
      <ServerStationShell actorName={actorName} wall={wall} title="Food promos" layout="pos">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&>*]:shrink-0 lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategory("food_special")}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#d36b4a] px-4 text-sm font-semibold text-white"
            >
              <UtensilsCrossedIcon className="size-4" aria-hidden />
              Food
            </button>
            <button
              type="button"
              onClick={() => setCategory("drink_special")}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm font-semibold"
            >
              <WineIcon className="size-4" aria-hidden />
              Drink
            </button>
            <p className="min-w-0 flex-1 truncate text-sm text-[#e8d5c4]">
              {headline ? `${headline}${price ? ` · ${price}` : ""}` : "Pick a dish"}
            </p>
            {DURATION_OPTIONS.map((option) => (
              <button
                key={String(option)}
                type="button"
                onClick={() => setDuration(option)}
                className={cn(
                  "min-h-12 rounded-2xl px-3 text-sm font-semibold",
                  duration === option ? "bg-[#d36b4a] text-white" : "border border-white/15 bg-white/5",
                )}
              >
                {durationPresetLabel(option)}
              </button>
            ))}
          </div>

          {resultMessage ? (
            <p className={cn("shrink-0 text-sm", resultOk ? "text-emerald-200" : "text-amber-100")}>{resultMessage}</p>
          ) : null}

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)]">
            <div className="order-2 min-h-0 min-w-0 overflow-y-auto lg:order-1">
              <div className="grid content-start grid-cols-2 gap-2 sm:grid-cols-3">
                {foodPresets.slice(presetPage * 15, presetPage * 15 + 15).map((preset) => {
                  const selected = preset.id === selectedPresetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyFoodPreset(preset)}
                      className={cn(
                        "flex h-[6.75rem] flex-col overflow-hidden rounded-2xl border text-left",
                        selected ? "border-[#d36b4a] ring-2 ring-[#d36b4a]" : "border-white/10",
                      )}
                    >
                      <span className="relative h-14 shrink-0 bg-black/40">
                        {preset.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preset.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 px-2 py-1">
                        <span className="block truncate text-sm font-bold text-[#f7efe6]">{preset.food}</span>
                        <span className="block truncate text-xs text-[#e8d5c4]">{formatFoodPrice(preset.price)}</span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setFoodComposer("custom");
                    setSelectedPresetId(null);
                    setHeadline("");
                    setPrice("");
                    setSubtitle("");
                    clearPhoto();
                  }}
                  className="flex h-[6.75rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/25 bg-white/5 px-3 text-center text-sm font-semibold text-[#f7efe6]"
                >
                  Add your own
                </button>
              </div>
            </div>
            <div className="order-1 flex min-h-0 min-w-0 flex-col gap-2 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:bg-[#14110f]/95 max-lg:pb-2 max-lg:backdrop-blur-md lg:order-2">
              <p className="shrink-0 text-xs font-semibold tracking-[0.14em] text-[#e8d5c4] uppercase">Wall preview</p>
              <div className="aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Wall preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#e8d5c4]">Building preview…</div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <ServerStationButton disabled={pending} onClick={() => void uploadGraphicAndPublish("show_now")}>
                  Show now
                </ServerStationButton>
                <ServerStationButton
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void uploadGraphicAndPublish("add_rotation")}
                >
                  Add to rotation
                </ServerStationButton>
                {foodPresets.length > 15 ? (
                  <>
                    <ServerStationButton
                      variant="secondary"
                      disabled={presetPage === 0}
                      onClick={() => setPresetPage((page) => Math.max(0, page - 1))}
                    >
                      Prev
                    </ServerStationButton>
                    <ServerStationButton
                      variant="secondary"
                      disabled={(presetPage + 1) * 15 >= foodPresets.length}
                      onClick={() => setPresetPage((page) => page + 1)}
                    >
                      Next
                    </ServerStationButton>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </ServerStationShell>
    );
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title={title}>
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">{title}</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          Fill in the basics, check the preview, then put it on the wall.
        </p>
      </div>

      {resultMessage ? (
        <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          <p>{resultMessage}</p>
          {resultOk ? (
            <StationLink href="/server/active" className="mt-3 inline-flex min-h-12 items-center text-base font-semibold underline">
              See your rotation
            </StationLink>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="order-2 space-y-5 lg:order-1">
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
                  onClick={() => {
                    setCategory(id);
                    if (id === "food_special") setFoodComposer("presets");
                  }}
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

          {mode === "special" && category === "food_special" ? (
            <div className="flex flex-wrap justify-end gap-3">
              <ServerStationButton variant="secondary" onClick={() => setFoodComposer("presets")}>
                Back to presets
              </ServerStationButton>
              <ServerStationButton variant="secondary" onClick={saveCustomFoodPreset}>
                Save to preset list
              </ServerStationButton>
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

        <div className="order-1 space-y-3 lg:order-2">
          <p className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Preview</p>
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/40">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Wall preview" className="aspect-video w-full object-contain" />
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
