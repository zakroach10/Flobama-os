"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { refundOrderAction } from "@/actions/ticketing";
import { Button } from "@/components/ui/button";

export function RefundOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await refundOrderAction(orderId, "Staff refund from order page");
          if (!result.ok) toast.error(result.message);
          else toast.success(result.message);
        });
      }}
    >
      Refund and release inventory
    </Button>
  );
}
