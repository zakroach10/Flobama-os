"use client";

import { useActionState, useState } from "react";
import { requestPasswordResetAction, signInAction, type AuthActionResult } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LED_OBS_DMG_HREF } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const initial: AuthActionResult | null = null;

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [state, action] = useActionState(async (_prev: AuthActionResult | null, formData: FormData) => {
    setPending(true);
    try {
      return await signInAction(formData);
    } finally {
      setPending(false);
    }
  }, initial);

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <Link className="underline-offset-4 hover:underline" href="/forgot-password">
            Forgot password
          </Link>
        </p>
      </form>
      <div className="mt-4 space-y-2 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Booth Macs can download the LED wall OBS client. The first open asks for the booth token from Screens.
        </p>
        <a href={LED_OBS_DMG_HREF} download className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Download OBS client (.dmg)
        </a>
      </div>
    </>
  );
}

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [state, action] = useActionState(async (_prev: AuthActionResult | null, formData: FormData) => {
    setPending(true);
    try {
      return await requestPasswordResetAction(formData);
    } finally {
      setPending(false);
    }
  }, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state ? (
        <p className={state.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
