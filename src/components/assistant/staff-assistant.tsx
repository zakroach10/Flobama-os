"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SparklesIcon, XIcon } from "lucide-react";
import { askStaffAssistantAction } from "@/actions/assistant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  text: string;
  href?: string;
  hrefLabel?: string;
};

export function StaffAssistant({
  canProgram,
  canChangeWall,
  configured,
}: {
  canProgram: boolean;
  canChangeWall: boolean;
  configured: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [turns, setTurns] = useState<Turn[]>([]);

  const suggestions = [
    canProgram ? "Add a live-music draft for Friday at 8pm" : null,
    canProgram ? "Publish tonight's show on the website" : null,
    canChangeWall ? "What's on the LED wall?" : null,
    canChangeWall ? "Put house ads on the wall" : null,
  ].filter((item): item is string => Boolean(item));

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    const history = [...turns, { role: "user" as const, text: message }];
    setTurns(history);
    setDraft("");
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

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5">
      {open ? (
        <section
          id="staff-assistant-panel"
          aria-label="FloBama assistant"
          className="pointer-events-auto flex h-[min(36rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl"
        >
          <header className="flex items-start gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">FloBama assistant</h2>
              <p className="text-xs text-muted-foreground">
                {canProgram
                  ? "Add artists and events, publish the public site, or change the LED wall."
                  : "Ask what is on the LED wall, or switch the scene."}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <XIcon />
            </Button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 ? (
              <div className="space-y-3">
                {configured ? (
                  <p className="text-sm text-muted-foreground">
                    Try a request in plain language. New shows stay drafts until you say to publish them.
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
                      onClick={() => void send(suggestion)}
                      className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
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
                    turn.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
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
            {pending ? <p className="text-xs text-muted-foreground">Working…</p> : null}
          </div>
          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="staff-assistant-input">
              Message the assistant
            </label>
            <textarea
              id="staff-assistant-input"
              value={draft}
              disabled={!configured || pending}
              rows={2}
              maxLength={2000}
              placeholder={configured ? "Add an artist, a show, or a wall scene" : "Assistant is off"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <Button type="submit" size="sm" disabled={!configured || pending || !draft.trim()}>
              Send
            </Button>
          </form>
        </section>
      ) : null}
      <Button
        type="button"
        className="pointer-events-auto shadow-lg"
        aria-expanded={open}
        aria-controls={open ? "staff-assistant-panel" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <SparklesIcon />
        {open ? "Hide" : "Ask"}
      </Button>
    </div>
  );
}
