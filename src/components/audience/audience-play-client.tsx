"use client";

import { useEffect, useState, useTransition } from "react";
import { AUDIENCE_POLL_MS } from "@/lib/constants";
import type { AudienceGuestState } from "@/lib/audience/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function sponsorTelHref(phone: unknown) {
  const display = String(phone ?? "").trim();
  const dial = display.replace(/[^\d+]/g, "");
  if (!display || !dial) return null;
  return { display, href: `tel:${dial}` };
}

export function AudiencePlayClient({ joinCode }: { joinCode: string }) {
  const [name, setName] = useState("");
  const [state, setState] = useState<AudienceGuestState | null>(null);
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/public/v1/audience/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { state?: AudienceGuestState | null };
        if (!cancelled && json.state && json.state.joinCode === joinCode.toUpperCase()) {
          setState(json.state);
        }
      } catch {
        /* ignore */
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), AUDIENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [joinCode]);

  function join() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/public/v1/audience/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: joinCode, displayName: name }),
      });
      const json = (await res.json()) as { state?: AudienceGuestState; error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Could not join.");
        return;
      }
      setState(json.state ?? null);
    });
  }

  function vote(choiceKey: string) {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/public/v1/audience/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choiceKey }),
      });
      const json = (await res.json()) as { state?: AudienceGuestState; error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Vote failed.");
        return;
      }
      setState(json.state ?? null);
    });
  }

  function submitQuestion() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/public/v1/audience/question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: question }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Could not submit.");
        return;
      }
      setQuestion("");
      setMessage("Question submitted — waiting for producer approval.");
    });
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Join the live show</h1>
        <p className="text-sm text-muted-foreground">
          Code <span className="font-mono font-semibold">{joinCode.toUpperCase()}</span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </div>
        <Button type="button" className="min-h-12 w-full" disabled={pending || name.trim().length < 1} onClick={join}>
          {pending ? "Joining…" : "Join"}
        </Button>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
    );
  }

  const tool = state.tool;
  return (
    <div className="mx-auto max-w-md space-y-5 p-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">You’re in</p>
        <h1 className="text-2xl font-semibold">{state.displayName}</h1>
        <p className="text-sm text-muted-foreground">Watch the wall — interact below when prompted.</p>
      </header>

      {!tool ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Waiting for the next interaction on the wall…
        </p>
      ) : tool.kind === "questions" ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="font-medium">{String(tool.payload.prompt ?? "Ask the hosts a question")}</p>
          <textarea
            className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-base"
            maxLength={280}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Type your question"
          />
          <Button type="button" className="min-h-11 w-full" disabled={pending || question.trim().length < 3} onClick={submitQuestion}>
            Submit question
          </Button>
        </div>
      ) : tool.kind === "poll" || tool.kind === "hot_take" || tool.kind === "host_picks" ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-lg font-semibold">
            {tool.kind === "hot_take"
              ? String(tool.payload.statement ?? tool.title)
              : String(tool.payload.prompt ?? tool.title)}
          </p>
          {!state.votingOpen ? (
            <p className="text-sm text-muted-foreground">Voting is closed.</p>
          ) : (
            <div className="grid gap-2">
              {tool.tallies.map((row) => (
                <Button
                  key={row.key}
                  type="button"
                  variant={state.myVote === row.key ? "default" : "outline"}
                  className="min-h-12 justify-start text-base"
                  disabled={pending}
                  onClick={() => vote(row.key)}
                >
                  {row.label}
                </Button>
              ))}
            </div>
          )}
          {state.resultsRevealed ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {tool.tallies.map((row) => (
                <li key={row.key}>
                  {row.label}: {row.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Results stay hidden until the hosts reveal them.</p>
          )}
        </div>
      ) : tool.kind === "sponsor" ? (
        <SponsorCard payload={tool.payload} title={tool.title} />
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          “{tool.title}” is on the wall — no phone action needed right now.
        </p>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function SponsorCard({ payload, title }: { payload: Record<string, unknown>; title: string }) {
  const phone = sponsorTelHref(payload.phone);
  const blurb = String(payload.blurb ?? "").trim();
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <p className="text-lg font-semibold">{String(payload.name ?? title)}</p>
      {phone ? (
        <a className="block text-base font-semibold text-primary" href={phone.href}>
          {phone.display}
        </a>
      ) : null}
      {blurb ? <p className="text-sm text-muted-foreground">{blurb}</p> : null}
    </div>
  );
}
