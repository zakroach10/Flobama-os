"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TableInventoryStatus } from "@/lib/ticketing/constants";
import { TABLE_STATUS_LABELS } from "@/lib/ticketing/constants";

export type MapObject = {
  id: string;
  name: string;
  objectType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  shape?: "rect" | "round" | "ellipse";
  status?: TableInventoryStatus;
  sellable?: boolean;
  vip?: boolean;
  tableNumber?: string | null;
  capacity?: number;
};

const STATUS_FILL: Record<TableInventoryStatus, string> = {
  available: "#2f6f46",
  held: "#b7791f",
  sold: "#8a3a32",
  blocked: "#4b433c",
  comp: "#3d5a80",
  unavailable: "#2a2420",
};

export function VenueMap({
  objects,
  canvasWidth,
  canvasHeight,
  selectedId,
  onSelect,
  onMove,
  interactive = true,
}: {
  objects: MapObject[];
  canvasWidth: number;
  canvasHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  interactive?: boolean;
}) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const viewBox = `0 0 ${canvasWidth} ${canvasHeight}`;

  const layers = useMemo(() => {
    const decor = objects.filter((object) => object.objectType !== "table" && object.objectType !== "booth");
    const tables = objects.filter((object) => object.objectType === "table" || object.objectType === "booth");
    return { decor, tables };
  }, [objects]);

  function pointerDown(event: React.PointerEvent<SVGRectElement | SVGEllipseElement>, object: MapObject) {
    if (!interactive) return;
    onSelect?.(object.id);
    if (!onMove) return;
    const svg = (event.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const cursor = point.matrixTransform(svg.getScreenCTM()?.inverse());
    (event.target as SVGElement).setPointerCapture(event.pointerId);
    setDrag({ id: object.id, dx: cursor.x - object.x, dy: cursor.y - object.y });
  }

  function pointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag || !onMove) return;
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const cursor = point.matrixTransform(svg.getScreenCTM()?.inverse());
    onMove(drag.id, Math.round((cursor.x - drag.dx) / 10) * 10, Math.round((cursor.y - drag.dy) / 10) * 10);
  }

  return (
    <div className="overflow-auto rounded-xl border bg-[#14110f]">
      <svg
        viewBox={viewBox}
        className="h-auto w-full touch-none"
        onPointerMove={pointerMove}
        onPointerUp={() => setDrag(null)}
        role="img"
        aria-label="FloBama room map"
      >
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#1b1612" />
        {layers.decor.map((object) => (
          <g key={object.id}>
            <rect
              x={object.x}
              y={object.y}
              width={object.width}
              height={object.height}
              rx={object.objectType === "stage" ? 10 : 6}
              fill={object.objectType === "stage" ? "#d36b4a" : object.objectType === "bar" ? "#3a2f28" : "#2a2320"}
              stroke="#5c4a40"
            />
            <text
              x={object.x + object.width / 2}
              y={object.y + object.height / 2 + 4}
              textAnchor="middle"
              fill="#f4ebe3"
              fontSize="14"
              fontFamily="ui-sans-serif, system-ui"
            >
              {object.name}
            </text>
          </g>
        ))}
        {layers.tables.map((object) => {
          const status = object.status ?? "unavailable";
          const selected = selectedId === object.id;
          return (
            <g key={object.id}>
              {object.shape === "round" ? (
                <ellipse
                  cx={object.x + object.width / 2}
                  cy={object.y + object.height / 2}
                  rx={object.width / 2}
                  ry={object.height / 2}
                  fill={STATUS_FILL[status]}
                  stroke={selected ? "#f4ebe3" : "#111"}
                  strokeWidth={selected ? 4 : 2}
                  className={cn(interactive && object.sellable !== false ? "cursor-pointer" : "cursor-default")}
                  onPointerDown={(event) => pointerDown(event, object)}
                />
              ) : (
                <rect
                  x={object.x}
                  y={object.y}
                  width={object.width}
                  height={object.height}
                  rx={10}
                  fill={STATUS_FILL[status]}
                  stroke={selected ? "#f4ebe3" : "#111"}
                  strokeWidth={selected ? 4 : 2}
                  className={cn(interactive && "cursor-pointer")}
                  onPointerDown={(event) => pointerDown(event, object)}
                />
              )}
              <text
                x={object.x + object.width / 2}
                y={object.y + object.height / 2 + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="13"
                fontWeight="700"
                className="pointer-events-none"
              >
                {object.tableNumber ?? object.name.replace("Table ", "")}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 border-t border-white/10 px-3 py-2 text-[11px] tracking-wide text-[#c9b8aa] uppercase">
        {(Object.keys(TABLE_STATUS_LABELS) as TableInventoryStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: STATUS_FILL[status] }} />
            {TABLE_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
