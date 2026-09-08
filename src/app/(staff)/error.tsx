"use client";

import { Button } from "@/components/ui/button";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Screens could not finish that action</h1>
      <p className="text-muted-foreground">
        {error.message || "A server error occurred while updating the playlist. Your file was not sent through the page request."}
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
