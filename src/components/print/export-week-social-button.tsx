import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ExportWeekSocialButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  return (
    <Button variant={variant} render={<Link href="/print/week/social" target="_blank" rel="noreferrer" />}>
      Social sizes
    </Button>
  );
}
