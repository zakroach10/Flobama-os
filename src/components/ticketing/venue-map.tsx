"use client";

import { useId, useMemo, useState } from "react";
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

function isTableLike(type: string) {
  return type === "table" || type === "booth";
}

function solidFill(object: MapObject, editor: boolean) {
  if (isTableLike(object.objectType)) {
    if (!editor) return STATUS_FILL[object.status ?? "unavailable"];
    return STATUS_FILL[object.status ?? (object.sellable === false ? "unavailable" : "available")];
  }
  switch (object.objectType) {
    case "stage":
      return "#d36b4a";
    case "bar":
      return "#3a2f28";
    case "dance_floor":
      return "#24362c";
    case "standing":
      return "#2a3328";
    case "vip_area":
      return "#4a2e28";
    case "entrance":
      return "#4a3a32";
    case "divider":
      return "#6a5a50";
    case "restroom":
      return "#2c3540";
    case "label":
      return "#1b1612";
    case "decor":
      return "#2a2320";
    default:
      return "#2a2320";
  }
}

function snap(value: number) {
  return Math.round(value / 10) * 10;
}

type Drag =
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string; startX: number; startY: number; origW: number; origH: number };

export function VenueMap({
  objects,
  canvasWidth,
  canvasHeight,
  selectedId,
  onSelect,
  onMove,
  onResize,
  interactive = true,
  editor = false,
}: {
  objects: MapObject[];
  canvasWidth: number;
  canvasHeight: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  interactive?: boolean;
  editor?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const dancePattern = `${uid}-dance`;
  const standingPattern = `${uid}-standing`;
  const [drag, setDrag] = useState<Drag | null>(null);
  const viewBox = `0 0 ${canvasWidth} ${canvasHeight}`;

  const layers = useMemo(() => {
    const structural = objects.filter((object) => !isTableLike(object.objectType));
    const tables = objects.filter((object) => isTableLike(object.objectType));
    return { structural, tables };
  }, [objects]);

  function cursorInSvg(event: React.PointerEvent, svg: SVGSVGElement) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM()?.inverse());
  }

  function pointerDown(event: React.PointerEvent<SVGElement>, object: MapObject) {
    if (!interactive) return;
    const selectable = editor || isTableLike(object.objectType);
    if (!selectable) return;
    onSelect?.(object.id);
    if (!onMove) return;
    const svg = (event.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const cursor = cursorInSvg(event, svg);
    (event.target as SVGElement).setPointerCapture(event.pointerId);
    setDrag({ kind: "move", id: object.id, dx: cursor.x - object.x, dy: cursor.y - object.y });
    event.stopPropagation();
  }

  function resizeDown(event: React.PointerEvent<SVGRectElement>, object: MapObject) {
    if (!editor || !onResize) return;
    const svg = (event.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const cursor = cursorInSvg(event, svg);
    (event.target as SVGElement).setPointerCapture(event.pointerId);
    setDrag({ kind: "resize", id: object.id, startX: cursor.x, startY: cursor.y, origW: object.width, origH: object.height });
    event.stopPropagation();
  }

  function pointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const cursor = cursorInSvg(event, event.currentTarget);
    if (drag.kind === "move" && onMove) {
      onMove(drag.id, snap(cursor.x - drag.dx), snap(cursor.y - drag.dy));
      return;
    }
    if (drag.kind === "resize" && onResize) {
      const width = Math.max(12, snap(drag.origW + (cursor.x - drag.startX)));
      const height = Math.max(12, snap(drag.origH + (cursor.y - drag.startY)));
      onResize(drag.id, width, height);
    }
  }

  function fillFor(object: MapObject) {
    if (object.objectType === "dance_floor") return `url(#${dancePattern})`;
    if (object.objectType === "standing") return `url(#${standingPattern})`;
    return solidFill(object, editor);
  }

  function renderObject(object: MapObject) {
    const selected = selectedId === object.id;
    const fill = fillFor(object);
    const table = isTableLike(object.objectType);
    const canGrab = editor || table;
    const cx = object.x + object.width / 2;
    const cy = object.y + object.height / 2;
    const round = object.shape === "round" || object.shape === "ellipse";
    const transform = object.rotation ? `rotate(${object.rotation} ${cx} ${cy})` : undefined;
    const label =
      table
        ? (object.tableNumber ?? object.name.replace("Table ", ""))
        : object.objectType === "restroom"
          ? "WC"
          : object.objectType === "divider"
            ? ""
            : object.name;
    const dash = object.objectType === "entrance" ? "10 6" : object.objectType === "label" ? "4 4" : undefined;
    const stroke =
      selected ? "#f4ebe3" : object.objectType === "divider" ? "#8a7a70" : object.objectType === "stage" ? "#f0a089" : "#5c4a40";
    const strokeWidth = selected ? 4 : object.objectType === "divider" ? 2 : object.objectType === "entrance" ? 2.5 : 1.5;
    const rx =
      object.objectType === "stage" ? 10 : object.objectType === "divider" ? 1 : object.objectType === "restroom" ? 4 : 6;

    return (
      <g key={object.id} transform={transform}>
        {round ? (
          <ellipse
            cx={cx}
            cy={cy}
            rx={object.width / 2}
            ry={object.height / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            className={cn(canGrab && interactive ? "cursor-pointer" : "cursor-default")}
            onPointerDown={(event) => pointerDown(event, object)}
          />
        ) : (
          <rect
            x={object.x}
            y={object.y}
            width={object.width}
            height={object.height}
            rx={rx}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            className={cn(canGrab && interactive ? "cursor-pointer" : "cursor-default")}
            onPointerDown={(event) => pointerDown(event, object)}
          />
        )}
        {object.objectType === "bar" ? (
          <rect
            x={object.x + 8}
            y={object.y + 12}
            width={Math.max(8, object.width - 16)}
            height={Math.max(8, object.height - 24)}
            rx={4}
            fill="#2a221c"
            className="pointer-events-none"
          />
        ) : null}
        {object.objectType === "restroom" ? (
          <line
            x1={cx}
            y1={object.y + 12}
            x2={cx}
            y2={object.y + object.height - 12}
            stroke="#8aa0b8"
            strokeWidth="2"
            className="pointer-events-none"
          />
        ) : null}
        {label ? (
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill="#f4ebe3"
            fontSize={table ? 13 : object.objectType === "restroom" ? 16 : object.objectType === "label" ? 12 : 13}
            fontWeight={table || object.objectType === "restroom" ? 700 : 500}
            className="pointer-events-none"
            fontFamily="ui-sans-serif, system-ui"
          >
            {label}
          </text>
        ) : null}
        {editor && selected ? (
          <rect
            x={object.x + object.width - 10}
            y={object.y + object.height - 10}
            width={16}
            height={16}
            fill="#f4ebe3"
            stroke="#111"
            className="cursor-nwse-resize"
            onPointerDown={(event) => resizeDown(event, object)}
          />
        ) : null}
      </g>
    );
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
        <defs>
          <pattern id={dancePattern} width="28" height="28" patternUnits="userSpaceOnUse">
            <rect width="28" height="28" fill="#24362c" />
            <circle cx="14" cy="14" r="3" fill="#2f4a3a" />
            <circle cx="0" cy="0" r="2" fill="#1c2a22" />
            <circle cx="28" cy="28" r="2" fill="#1c2a22" />
          </pattern>
          <pattern id={standingPattern} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#2a3328" />
            <path d="M0 16 L16 0" stroke="#3a4538" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#1b1612" />
        {layers.structural.map(renderObject)}
        {layers.tables.map(renderObject)}
      </svg>
      {editor ? (
        <p className="border-t border-white/10 px-3 py-2 text-[11px] tracking-wide text-[#c9b8aa] uppercase">
          Drag to move · corner handle to resize · save when the room is right
        </p>
      ) : (
        <div className="flex flex-wrap gap-3 border-t border-white/10 px-3 py-2 text-[11px] tracking-wide text-[#c9b8aa] uppercase">
          {(Object.keys(TABLE_STATUS_LABELS) as TableInventoryStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: STATUS_FILL[status] }} />
              {TABLE_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
