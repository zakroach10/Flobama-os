"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reorderItems } from "@/lib/audience/order";

export function ReorderList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  disabled = false,
  listLabel,
  className = "",
  renderItem,
}: {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onReorder: (next: T[]) => void;
  disabled?: boolean;
  listLabel: string;
  className?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  function move(index: number, direction: -1 | 1) {
    onReorder(reorderItems(items, index, index + direction));
  }

  function pointIndex(clientY: number) {
    let closest = dragRef.current ?? 0;
    let best = Number.POSITIVE_INFINITY;
    itemRefs.current.forEach((node, index) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < best) {
        best = distance;
        closest = index;
      }
    });
    return closest;
  }

  function finishDrag() {
    const from = dragRef.current;
    const to = overRef.current;
    dragRef.current = null;
    overRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
    if (from !== null && to !== null && from !== to) {
      onReorder(reorderItems(items, from, to));
    }
  }

  return (
    <ul aria-label={listLabel} className={className}>
      {items.map((item, index) => {
        const label = getLabel(item);
        const dragging = dragIndex === index;
        const target = overIndex === index && dragIndex !== null && dragIndex !== index;
        return (
          <li
            key={getId(item)}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className={`flex items-start gap-2 ${target ? "rounded-lg ring-2 ring-primary" : ""} ${dragging ? "opacity-70" : ""}`}
          >
            <div className="flex shrink-0 flex-col gap-1 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 px-2"
                disabled={disabled || index === 0}
                aria-label={`Move ${label} up`}
                onClick={() => move(index, -1)}
              >
                Up
              </Button>
              <button
                type="button"
                className="flex h-11 w-11 touch-none items-center justify-center rounded-md border bg-background text-lg leading-none select-none"
                aria-label={`Drag ${label}`}
                disabled={disabled}
                onPointerDown={(event) => {
                  if (disabled || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragRef.current = index;
                  overRef.current = index;
                  setDragIndex(index);
                  setOverIndex(index);
                }}
                onPointerMove={(event) => {
                  if (dragRef.current === null) return;
                  const next = pointIndex(event.clientY);
                  overRef.current = next;
                  setOverIndex(next);
                }}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
              >
                ⋮⋮
              </button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 px-2"
                disabled={disabled || index === items.length - 1}
                aria-label={`Move ${label} down`}
                onClick={() => move(index, 1)}
              >
                Down
              </Button>
            </div>
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
          </li>
        );
      })}
    </ul>
  );
}
