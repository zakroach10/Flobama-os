"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MicIcon, SparklesIcon, SquareIcon, XIcon } from "lucide-react";
import { askStaffAssistantAction } from "@/actions/assistant";
import { speechTranscript, type SpeechChunk } from "@/lib/assistant/speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  text: string;
  href?: string;
  hrefLabel?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function StaffAssistant({
  canProgram,
  canChangeWall,
  configured,
  placement = "fab",
  open: openProp,
  onOpenChange,
  initialOpen = false,
}: {
  canProgram: boolean;
  canChangeWall: boolean;
  configured: boolean;
  /** fab floats on staff pages. dock sits above the Server Station phone nav. */
  placement?: "fab" | "dock";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);
  const open = openProp ?? uncontrolledOpen;
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const sendOnEndRef = useRef(true);
  const sendRef = useRef<(text: string) => void>(() => undefined);
  const dock = placement === "dock";

  function setOpen(next: boolean) {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
  }

  const suggestions = [
    canProgram ? "Add a live-music draft for Friday at 8pm" : null,
    canProgram ? "Publish tonight's show on the website" : null,
    canChangeWall ? "What's on the LED wall?" : null,
    canChangeWall ? "Put house ads on the wall" : null,
  ].filter((item): item is string => Boolean(item));

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    const history = [...turns, { role: "user" as const, text: message }];
    setTurns(history);
    setDraft("");
    setMicNote(null);
    startTransition(async () => {
      try {
        const result = await askStaffAssistantAction({
          messages: history.map((turn) => ({ role: turn.role, text: turn.text })),
        });
        setTurns((current) => [
          ...current,
          {
            role: "assistant",
            text: result.reply,
            href: result.href,
            hrefLabel: result.hrefLabel,
          },
        ]);
        if (result.changed) router.refresh();
      } catch {
        setTurns((current) => [
          ...current,
          { role: "assistant", text: "The assistant could not be reached. Try again." },
        ]);
      }
    });
  }

  function stopMic(sendResult: boolean) {
    sendOnEndRef.current = sendResult;
    recognitionRef.current?.stop();
  }

  function toggleMic() {
    sendRef.current = send;
    if (listening) {
      stopMic(true);
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setMicNote("This browser has no microphone dictation. Type the request instead.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    transcriptRef.current = "";
    sendOnEndRef.current = true;
    recognition.onresult = (event) => {
      const chunks: SpeechChunk[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const row = event.results[index];
        chunks.push({ transcript: row[0]?.transcript ?? "", isFinal: row.isFinal });
      }
      const text = speechTranscript(chunks);
      transcriptRef.current = text;
      setDraft(text);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicNote("Allow the microphone to speak to the assistant.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setMicNote("The microphone stopped. Try again or type the request.");
      }
      sendOnEndRef.current = false;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = transcriptRef.current.trim();
      transcriptRef.current = "";
      if (sendOnEndRef.current && text) sendRef.current(text);
      sendOnEndRef.current = true;
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      setMicNote(null);
      setDraft("");
    } catch {
      setMicNote("The microphone could not start. Type the request instead.");
    }
  }

  const panel = open ? (
    <section
      id="staff-assistant-panel"
      aria-label="FloBama assistant"
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden shadow-xl",
        dock
          ? "absolute inset-x-2 bottom-[calc(100%+0.4rem)] z-50 h-[min(32rem,calc(100dvh-8.5rem))] rounded-[28px] border border-white/12 bg-[#1a1613] text-[#f7efe6]"
          : "h-[min(36rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border bg-card text-card-foreground",
      )}
    >
      <header className={cn("flex items-start gap-3 border-b px-4 py-3", dock && "border-white/10")}>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">FloBama assistant</h2>
          <p className={cn("text-xs", dock ? "text-[#e8d5c4]" : "text-muted-foreground")}>
            {canProgram
              ? "Add artists and events, publish the public site, or change the LED wall."
              : "Ask what is on the LED wall, or switch the scene."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close assistant"
          className={dock ? "text-[#f7efe6] hover:bg-white/10" : undefined}
          onClick={() => setOpen(false)}
        >
          <XIcon />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 ? (
          <div className="space-y-3">
            {configured ? (
              <p className={cn("text-sm", dock ? "text-[#e8d5c4]" : "text-muted-foreground")}>
                Type a request or tap the microphone and speak. New shows stay drafts until you say to publish them.
              </p>
            ) : (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                Add OPENAI_API_KEY on the server to turn the assistant on. Band-fit analysis uses the same key.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!configured || pending}
                  onClick={() => send(suggestion)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50",
                    dock ? "border-white/15 text-[#f7efe6] hover:bg-white/5" : "hover:bg-muted",
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={cn(
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm",
                turn.role === "user"
                  ? dock
                    ? "ml-auto bg-[#d36b4a] text-white"
                    : "ml-auto bg-primary text-primary-foreground"
                  : dock
                    ? "bg-black/35 text-[#f7efe6]"
                    : "bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap">{turn.text}</p>
              {turn.href && turn.hrefLabel ? (
                <Link href={turn.href} className="mt-1 inline-block text-sm font-medium underline">
                  {turn.hrefLabel}
                </Link>
              ) : null}
            </div>
          ))
        )}
        {pending ? <p className={cn("text-xs", dock ? "text-[#e8d5c4]" : "text-muted-foreground")}>Working…</p> : null}
        {listening ? (
          <p className="text-xs font-semibold text-[#f0a58a]">Listening… speak, then pause to send.</p>
        ) : null}
      </div>
      <form
        className={cn("flex items-end gap-2 border-t p-3", dock && "border-white/10")}
        onSubmit={(event) => {
          event.preventDefault();
          if (listening) stopMic(false);
          send(draft);
        }}
      >
        <button
          type="button"
          aria-label={listening ? "Stop microphone" : "Speak to the assistant"}
          aria-pressed={listening}
          disabled={!configured || pending}
          onClick={toggleMic}
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full border text-white shadow-md disabled:opacity-40",
            listening ? "animate-pulse border-white bg-[#d36b4a]" : "border-[#d36b4a] bg-[#d36b4a]",
          )}
        >
          {listening ? <SquareIcon className="size-4" aria-hidden /> : <MicIcon className="size-5" aria-hidden />}
        </button>
        <label className="sr-only" htmlFor="staff-assistant-input">
          Message the assistant
        </label>
        <textarea
          id="staff-assistant-input"
          value={draft}
          disabled={!configured || pending}
          rows={2}
          maxLength={2000}
          placeholder={listening ? "Listening…" : configured ? "Speak or type" : "Assistant is off"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (listening) stopMic(false);
              send(draft);
            }
          }}
          className={cn(
            "max-h-28 min-h-12 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-50",
            dock
              ? "border-white/15 bg-black/30 text-[#f7efe6] placeholder:text-[#e8d5c4]/70"
              : "border-input bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        />
        <Button type="submit" size="sm" disabled={!configured || pending || !draft.trim()}>
          Send
        </Button>
      </form>
      {micNote ? (
        <p className={cn("px-3 pb-3 text-xs", dock ? "text-amber-200" : "text-amber-800")}>{micNote}</p>
      ) : null}
    </section>
  ) : null;

  if (dock) return panel;

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5">
      {panel}
      <Button
        type="button"
        className="pointer-events-auto shadow-lg"
        aria-expanded={open}
        aria-controls={open ? "staff-assistant-panel" : undefined}
        onClick={() => setOpen(!open)}
      >
        <SparklesIcon />
        {open ? "Hide" : "Ask"}
      </Button>
    </div>
  );
}
