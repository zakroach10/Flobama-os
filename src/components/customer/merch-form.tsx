"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveMerchAction, saveMerchAction } from "@/actions/customer-app";
import { formatUsd } from "@/lib/customer/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  sku: string | null;
  sort_order: number;
  active: boolean;
};

export function MerchForm({ product, canEdit }: { product?: Product; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? formatUsd(product.price_cents).slice(1) : "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));
  const [active, setActive] = useState(product?.active ?? true);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    startTransition(async () => {
      const result = await saveMerchAction(
        { name, description, price, sku, sortOrder: Number(sortOrder) || 0, active },
        product?.id,
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (!product) {
        setName("");
        setDescription("");
        setPrice("");
        setSku("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`merch-name-${product?.id ?? "new"}`}>Name</Label>
        <Input id={`merch-name-${product?.id ?? "new"}`} value={name} onChange={(event) => setName(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`merch-price-${product?.id ?? "new"}`}>Price (USD)</Label>
        <Input id={`merch-price-${product?.id ?? "new"}`} value={price} onChange={(event) => setPrice(event.target.value)} required disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`merch-desc-${product?.id ?? "new"}`}>Description</Label>
        <Textarea id={`merch-desc-${product?.id ?? "new"}`} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`merch-sku-${product?.id ?? "new"}`}>SKU</Label>
        <Input id={`merch-sku-${product?.id ?? "new"}`} value={sku} onChange={(event) => setSku(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`merch-sort-${product?.id ?? "new"}`}>Sort</Label>
        <Input id={`merch-sort-${product?.id ?? "new"}`} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} disabled={!canEdit || pending} />
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={!canEdit || pending} />
        Available in the app
      </label>
      {canEdit ? (
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={pending}>{product ? "Save" : "Add product"}</Button>
          {product ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await archiveMerchAction(product.id);
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
