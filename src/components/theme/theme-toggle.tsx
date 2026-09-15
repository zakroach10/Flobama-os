"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon-sm" : "icon"}
      className={cn(compact ? undefined : "min-h-11 min-w-11", className)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

export function ThemeModePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? (theme === "dark" ? "dark" : "light") : "light";

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)} role="group" aria-label="Color mode">
      {(
        [
          ["light", "Light"],
          ["dark", "Dark"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          variant={current === value ? "default" : "outline"}
          aria-pressed={current === value}
          onClick={() => setTheme(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
