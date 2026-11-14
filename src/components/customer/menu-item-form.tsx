"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveMenuItemAction, saveMenuItemAction } from "@/actions/customer-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price_label: string;
  sort_order: number;
  available: boolean;
};

export function MenuItemForm({ item, canEdit }: { item?: Item; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(item?.category ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceLabel, setPriceLabel] = useState(item?.price_label ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? 0));
  const [available, setAvailable] = useState(item?.available ?? true);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const result = await saveMenuItemAction(
        { category, name, description, priceLabel, sortOrder: Number(sortOrder) || 0, available },
        item?.id,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (!item) {
        setName("");
        setDescription("");
        setPriceLabel("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`cat-${item?.id ?? "new"}`}>Category</Label>
        <Input id={`cat-${item?.id ?? "new"}`} value={category} onChange={(event) => setCategory(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`name-${item?.id ?? "new"}`}>Name</Label>
        <Input id={`name-${item?.id ?? "new"}`} value={name} onChange={(event) => setName(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`desc-${item?.id ?? "new"}`}>Description</Label>
        <Textarea id={`desc-${item?.id ?? "new"}`} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`price-${item?.id ?? "new"}`}>Price label</Label>
        <Input id={`price-${item?.id ?? "new"}`} value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`sort-${item?.id ?? "new"}`}>Sort</Label>
        <Input id={`sort-${item?.id ?? "new"}`} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} inputMode="numeric" disabled={!canEdit || pending} />
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} disabled={!canEdit || pending} />
        Show in the app
      </label>
      {canEdit ? (
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={pending}>{item ? "Save" : "Add item"}</Button>
          {item ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await archiveMenuItemAction(item.id);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              Archive
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
