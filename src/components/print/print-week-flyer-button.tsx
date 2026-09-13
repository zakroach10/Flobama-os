import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintWeekFlyerButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  return (
    <Button
      variant={variant}
      className="w-full sm:w-auto"
      render={<Link href="/print/week" target="_blank" rel="noreferrer" />}
    >
      Print this week’s flyer
    </Button>
  );
}
