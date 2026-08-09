"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  enableDevValidations,
  themeQuartz,
  type ColDef,
  type CellContextMenuEvent,
} from "ag-grid-community";
import {
  ModuleRegistry as ChartsModuleRegistry,
  AllCommunityModule as AllChartsCommunityModule,
} from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import * as XLSX from "xlsx";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";

ModuleRegistry.registerModules([AllCommunityModule]);
ChartsModuleRegistry.registerModules([AllChartsCommunityModule]);

if (process.env.NODE_ENV !== "production") enableDevValidations();

export const appGridTheme = themeQuartz.withParams({
  backgroundColor: "#111111",
  foregroundColor: "#e5e5e5",
  headerBackgroundColor: "#1a1a1a",
  headerTextColor: "#ccc",
  borderColor: "#2a2a2a",
  rowHoverColor: "#1c1c1c",
  oddRowBackgroundColor: "#141414",
  chromeBackgroundColor: "#161616",
  accentColor: "#2563eb",
});

export const currencyFormatter = (params: { value: number }) =>
  params.value == null
    ? ""
    : `₹${params.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const relativeDateFormatter = (params: { value: string | null }) => {
  if (!params.value) return "—";
  const d = new Date(params.value);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString();
};

// ── Chart config ─────────────────────────────────────────────────────────
// ag-charts-community (free) only ships Bar/Column, Line, Area, Pie/Donut,
// Scatter/Bubble and Combination series. Histogram, Radar, Nightingale,
// Radial, Range, Box Plot, Treemap, Sankey, Waterfall, Funnel etc. all
// require ag-charts-enterprise, so they're intentionally left out.

type ChartFamily = "column" | "bar" | "pie" | "line" | "area" | "scatter" | "combination";
type ChartVariant = "grouped" | "stacked" | "stacked100" | "donut" | "bubble";
type ChartSelection = { family: ChartFamily; variant?: ChartVariant; label: string };
type NumericCol = { field: string; headerName?: string };

function minNumericFor(sel: ChartSelection): number {
  if (sel.family === "scatter") return sel.variant === "bubble" ? 3 : 2;
  if (sel.family === "combination") return 2;
  return 1;
}

function buildSeriesConfig(sel: ChartSelection, categoryField: string, numericCols: NumericCol[]): any[] | null {
  if (numericCols.length === 0) return null;
  switch (sel.family) {
    case "column":
    case "bar": {
      const direction = sel.family === "bar" ? "horizontal" : "vertical";
      const isStacked = sel.variant === "stacked" || sel.variant === "stacked100";
      return numericCols.map((c) => ({
        type: "bar",
        direction,
        xKey: categoryField,
        yKey: c.field,
        yName: c.headerName || c.field,
        ...(isStacked ? { stacked: true } : { grouped: true }),
        ...(sel.variant === "stacked100" ? { normalizedTo: 100 } : {}),
      }));
    }
    case "area": {
      const isStacked = sel.variant === "stacked" || sel.variant === "stacked100";
      return numericCols.map((c) => ({
        type: "area",
        xKey: categoryField,
        yKey: c.field,
        yName: c.headerName || c.field,
        ...(isStacked ? { stacked: true } : {}),
        ...(sel.variant === "stacked100" ? { normalizedTo: 100 } : {}),
      }));
    }
    case "line":
      return numericCols.map((c) => ({ type: "line", xKey: categoryField, yKey: c.field, yName: c.headerName || c.field }));
    case "pie":
      return [
        {
          type: "pie",
          angleKey: numericCols[0].field,
          legendItemKey: categoryField,
          calloutLabelKey: categoryField,
          ...(sel.variant === "donut" ? { innerRadiusRatio: 0.6 } : {}),
        },
      ];
    case "scatter": {
      if (sel.variant === "bubble") {
        if (numericCols.length < 3) return null;
        return [{ type: "bubble", xKey: numericCols[0].field, yKey: numericCols[1].field, sizeKey: numericCols[2].field, xName: numericCols[0].headerName, yName: numericCols[1].headerName }];
      }
      if (numericCols.length < 2) return null;
      return [{ type: "scatter", xKey: numericCols[0].field, yKey: numericCols[1].field, xName: numericCols[0].headerName || numericCols[0].field, yName: numericCols[1].headerName || numericCols[1].field }];
    }
    case "combination": {
      if (numericCols.length < 2) return null;
      return [
        { type: "bar", xKey: categoryField, yKey: numericCols[0].field, yName: numericCols[0].headerName || numericCols[0].field },
        { type: "line", xKey: categoryField, yKey: numericCols[1].field, yName: numericCols[1].headerName || numericCols[1].field },
      ];
    }
    default:
      return null;
  }
}

// ── Generic recursive flyout menu (used for both right-click and the 3-dot button) ──

type MenuNode = {
  label: string;
  disabled?: boolean;
  onSelect?: () => void;
  closeOnSelect?: boolean; // default true; set false for things like column toggles
  children?: MenuNode[];
};

const MENU_ITEM_H = 34;
const MENU_WIDTH = 220;

function MenuLevel({
  items,
  x,
  y,
  level = 0,
  onRequestClose,
}: {
  items: MenuNode[];
  x: number;
  y: number;
  level?: number;
  onRequestClose: () => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const flip = typeof window !== "undefined" && x + MENU_WIDTH * 2 > window.innerWidth;
  const left = flip ? x - MENU_WIDTH : x;

  const estHeight = items.length * MENU_ITEM_H;
  const top =
    typeof window !== "undefined" && y + estHeight > window.innerHeight
      ? Math.max(8, window.innerHeight - estHeight - 8)
      : y;

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: MENU_WIDTH,
        background: "#161616",
        border: "1px solid #2a2a2a",
        borderRadius: 6,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        zIndex: 9999 + level,
        overflow: "visible",
      }}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          onMouseEnter={() => !item.disabled && setOpenIdx(idx)}
          onClick={() => {
            if (item.disabled) return;
            if (item.onSelect) {
              item.onSelect();
              if (item.closeOnSelect !== false) onRequestClose();
            }
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            fontSize: 13,
            cursor: item.disabled ? "default" : "pointer",
            color: item.disabled ? "#555" : "#eee",
            background: openIdx === idx && !item.disabled ? "#1f1f1f" : "transparent",
            whiteSpace: "nowrap",
          }}
        >
          <span>{item.label}</span>
          {item.children && <span style={{ color: "#666", marginLeft: 8 }}>›</span>}
        </div>
      ))}
      {openIdx !== null && items[openIdx].children && (
        <MenuLevel
          items={items[openIdx].children!}
          x={flip ? left - MENU_WIDTH : left + MENU_WIDTH}
          y={top + openIdx * MENU_ITEM_H}
          level={level + 1}
          onRequestClose={onRequestClose}
        />
      )}
    </div>
  );
}

// ── Floating, draggable, resizable chart window ─────────────────────────

type ChartWindowState = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  options: any;
  z: number;
};

function FloatingChartWindow({
  win,
  onClose,
  onUpdate,
  onFocus,
}: {
  win: ChartWindowState;
  onClose: (id: string) => void;
  onUpdate: (id: string, partial: Partial<ChartWindowState>) => void;
  onFocus: (id: string) => void;
}) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      onUpdate(win.id, { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    },
    [onUpdate, win.id]
  );
  const handleDragUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragUp);
  }, [handleDragMove]);

  function handleHeaderMouseDown(e: React.MouseEvent) {
    onFocus(win.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: win.x, origY: win.y };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragUp);
  }

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = e.clientX - resizeRef.current.startX;
      const dh = e.clientY - resizeRef.current.startY;
      onUpdate(win.id, { width: Math.max(320, resizeRef.current.origW + dw), height: Math.max(240, resizeRef.current.origH + dh) });
    },
    [onUpdate, win.id]
  );
  const handleResizeUp = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeUp);
  }, [handleResizeMove]);

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    onFocus(win.id);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: win.width, origH: win.height };
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
  }

  return (
    <div
      onMouseDown={() => onFocus(win.id)}
      style={{
        position: "fixed",
        top: win.y,
        left: win.x,
        width: win.width,
        height: win.height,
        background: "#161616",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        zIndex: win.z,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: "move", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", fontSize: 12.5, color: "#ccc" }}
      >
        <span>{win.title}</span>
        <button onClick={() => onClose(win.id)} style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, lineHeight: 1 }} aria-label="Close chart">✕</button>
      </div>
      <div style={{ flex: 1, padding: 8, minHeight: 0 }}>
        <AgCharts options={win.options} />
      </div>
      <div onMouseDown={handleResizeMouseDown} style={{ position: "absolute", right: 3, bottom: 2, width: 14, height: 14, cursor: "nwse-resize", color: "#444", fontSize: 12, lineHeight: "14px" }}>◢</div>
    </div>
  );
}

// ── Selection range (drag-to-select) ────────────────────────────────────

type SelRange = { rowMin: number; rowMax: number; colIds: string[] };

function hasMeaningfulRange(sel: SelRange | null): sel is SelRange {
  return !!sel && (sel.rowMax > sel.rowMin || sel.colIds.length > 1);
}
function rangeLabel(sel: SelRange) {
  const rowCount = sel.rowMax - sel.rowMin + 1;
  return `${rowCount} row${rowCount > 1 ? "s" : ""} × ${sel.colIds.length} col${sel.colIds.length > 1 ? "s" : ""}`;
}

function csvEscape(v: any): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Context menu state ──────────────────────────────────────────────────

type ContextMenuState = {
  x: number;
  y: number;
  cellValue: string;
  rowData: Record<string, any>;
  rowIndex: number | null;
  colId: string;
} | null;

type DataGridProps<T> = {
  rows: T[];
  columnDefs: ColDef<T>[];
  height?: number;
  getRowId?: (row: T) => string;
  exportFileName?: string;
  title?: string;
};

// ── Main component ─────────────────────────────────────────────────────

export default function DataGrid<T extends Record<string, any>>({
  rows,
  columnDefs,
  height = 420,
  getRowId,
  exportFileName = "export",
  title,
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);
  const rangeActionBarRef = useRef<HTMLDivElement>(null);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [toolbarMenuPos, setToolbarMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [chartWindows, setChartWindows] = useState<ChartWindowState[]>([]);
  const [selection, setSelection] = useState<SelRange | null>(null);

  const zCounter = useRef(10000);
  const cascade = useRef(0);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragAnchorRef = useRef<{ rowIndex: number; colId: string } | null>(null);
  const selectionRef = useRef<SelRange | null>(null);

  // Shared by every action in the Copy/Charts/Export menus — clears the
  // drag-selected range and resets drag state once the action is done, so
  // the highlight disappears and the user can immediately drag a new range.
  function clearSelection() {
    draggingRef.current = false;
    dragAnchorRef.current = null;
    setSelection(null);
  }

  const numericCols = useMemo<NumericCol[]>(
    () => columnDefs.filter((c) => c.cellDataType === "number" && c.field).map((c) => ({ field: c.field as string, headerName: c.headerName || (c.field as string) })),
    [columnDefs]
  );
  const categoryField = useMemo<string | undefined>(() => {
    const col = columnDefs.find((c) => c.cellDataType === "text" && c.field) || columnDefs.find((c) => c.field);
    return col?.field as string | undefined;
  }, [columnDefs]);

  const toggleableColumns = useMemo(
    () => columnDefs.filter((c) => c.colId || c.field).map((c) => ({ colId: (c.colId || (c.field as string))!, headerName: c.headerName || (c.field as string) || "" })),
    [columnDefs]
  );
  function isColumnVisible(colId: string) {
    return columnVisibility[colId] !== false;
  }
  function toggleColumn(colId: string) {
    const nextVisible = !isColumnVisible(colId);
    gridRef.current?.api?.setColumnsVisible([colId], nextVisible);
    setColumnVisibility((prev) => ({ ...prev, [colId]: nextVisible }));
  }

  // ── Drag-to-select cell ranges ───────────────────────────────────────

  function getDisplayedColIds(): string[] {
    return (gridRef.current?.api?.getAllDisplayedColumns() ?? []).map((c) => c.getColId());
  }
  function computeRange(anchor: { rowIndex: number; colId: string }, current: { rowIndex: number; colId: string }): SelRange {
    const allCols = getDisplayedColIds();
    const a = allCols.indexOf(anchor.colId);
    const b = allCols.indexOf(current.colId);
    const colIds = allCols.slice(Math.min(a, b), Math.max(a, b) + 1);
    return { rowMin: Math.min(anchor.rowIndex, current.rowIndex), rowMax: Math.max(anchor.rowIndex, current.rowIndex), colIds };
  }

  const onCellMouseDown = useCallback((e: any) => {
    if (e.event && e.event.button !== 0) return; // only left-click drags a range
    const rowIndex = e.rowIndex ?? e.node?.rowIndex;
    if (rowIndex == null) return;
    const colId = e.column.getColId();
    draggingRef.current = true;
    didDragRef.current = false; // becomes true only if the pointer actually moves to a different cell
    dragAnchorRef.current = { rowIndex, colId };
    setSelection(computeRange({ rowIndex, colId }, { rowIndex, colId }));
  }, []);

  const onCellMouseOver = useCallback((e: any) => {
    if (!draggingRef.current || !dragAnchorRef.current) return;
    const rowIndex = e.rowIndex ?? e.node?.rowIndex;
    if (rowIndex == null) return;
    const colId = e.column.getColId();
    if (rowIndex !== dragAnchorRef.current.rowIndex || colId !== dragAnchorRef.current.colId) {
      didDragRef.current = true;
    }
    setSelection(computeRange(dragAnchorRef.current, { rowIndex, colId }));
  }, []);

  useEffect(() => {
    function onUp() {
      draggingRef.current = false;
      // A plain click (mousedown + mouseup on the same cell, no drag in between)
      // shouldn't leave a single cell highlighted -- only a real drag should.
      if (!didDragRef.current) {
        clearSelection();
      }
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  // Clicking anywhere outside the grid's own container clears whatever is
  // currently selected -- e.g. clicking another part of the page, a summary
  // card, or a chart window. Excludes the context menu, toolbar menu, and
  // floating range action bar themselves, since their own buttons read the
  // live selection on click -- clearing it first (mousedown fires before
  // click) would wipe the data those buttons are about to act on.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!selectionRef.current) return;
      const target = e.target as Node;
      const insideGrid = gridWrapperRef.current?.contains(target);
      const insideContextMenu = contextMenuRef.current?.contains(target);
      const insideToolbarMenu = toolbarMenuRef.current?.contains(target);
      const insideActionBar = rangeActionBarRef.current?.contains(target);
      if (!insideGrid && !insideContextMenu && !insideToolbarMenu && !insideActionBar) {
        clearSelection();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keep a ref in sync so cellStyle (a stable callback) can read live selection
  // without forcing every column definition to be recreated on drag.
  useEffect(() => {
    selectionRef.current = selection;
    gridRef.current?.api?.refreshCells({ force: true });
  }, [selection]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      cellStyle: (params: any) => {
        const sel = selectionRef.current;
        if (!sel) return undefined;
        const rowIndex = params.node?.rowIndex;
        const colId = params.column?.getColId?.();
        if (rowIndex == null || !colId) return undefined;
        const inRange = rowIndex >= sel.rowMin && rowIndex <= sel.rowMax && sel.colIds.includes(colId);
        return inRange ? { background: "rgba(37,99,235,0.22)", boxShadow: "inset 0 0 0 1px rgba(37,99,235,0.55)" } : { background: "none", boxShadow: "none" };
      },
    }),
    []
  );

  function getRowsForRange(sel: SelRange): T[] {
    const api = gridRef.current?.api;
    if (!api) return [];
    const out: T[] = [];
    for (let i = sel.rowMin; i <= sel.rowMax; i++) {
      const data = api.getDisplayedRowAtIndex(i)?.data;
      if (data) out.push(data);
    }
    return out;
  }

  // ── Close menus on outside click / Escape / scroll ───────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
      if (toolbarMenuPos && toolbarMenuRef.current && !toolbarMenuRef.current.contains(e.target as Node) && e.target !== menuButtonRef.current) setToolbarMenuPos(null);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
        setToolbarMenuPos(null);
      }
    }
    function handleScroll() {
      setContextMenu(null);
      setToolbarMenuPos(null);
    }
    if (contextMenu || toolbarMenuPos) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu, toolbarMenuPos]);

  // ── Context menu open ─────────────────────────────────────────────────

  const onCellContextMenu = useCallback((e: CellContextMenuEvent) => {
    const mouse = e.event as MouseEvent | undefined;
    mouse?.preventDefault();
    mouse?.stopPropagation();
    if (!mouse) return;
    setContextMenu({
      x: mouse.clientX,
      y: mouse.clientY,
      cellValue: String(e.value ?? ""),
      rowData: e.data ?? {},
      rowIndex: e.rowIndex ?? e.node?.rowIndex ?? null,
      colId: e.column?.getColId?.() ?? "",
    });
  }, []);

  function copyCellValue() {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.cellValue).catch(() => {});
    clearSelection();
  }
  function copyRowAsJson() {
    if (!contextMenu) return;
    navigator.clipboard.writeText(JSON.stringify(contextMenu.rowData, null, 2)).catch(() => {});
    clearSelection();
  }
  function copyRangeAsJson(rangeRows: Record<string, any>[]) {
    navigator.clipboard.writeText(JSON.stringify(rangeRows, null, 2)).catch(() => {});
    clearSelection();
  }

  // ── Chart windows ─────────────────────────────────────────────────────

  function openChartWindowRaw(sel: ChartSelection, sourceRows: T[], catField: string, numCols: NumericCol[]) {
    if (sourceRows.length === 0) return;
    const series = buildSeriesConfig(sel, catField, numCols);
    if (!series) return;
    const id = `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const offset = (cascade.current++ % 6) * 28;
    zCounter.current += 1;
    setChartWindows((prev) => [
      ...prev,
      { id, title: `${sel.label} chart`, x: 80 + offset, y: 80 + offset, width: 520, height: 380, options: { data: sourceRows, series, background: { fill: "#161616" }, theme: "ag-default-dark" }, z: zCounter.current },
    ]);

    // Clear the drag-selected range once its chart has been created, so the
    // highlight disappears and the user can immediately drag a fresh range
    // and right-click again without manually clearing the old one first.
    clearSelection();
  }
  function closeChartWindow(id: string) {
    setChartWindows((prev) => prev.filter((w) => w.id !== id));
  }
  function updateChartWindow(id: string, partial: Partial<ChartWindowState>) {
    setChartWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...partial } : w)));
  }
  function focusChartWindow(id: string) {
    zCounter.current += 1;
    const z = zCounter.current;
    setChartWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z } : w)));
  }

  // ── Export helpers ────────────────────────────────────────────────────

  function exportAllCsv() {
    gridRef.current?.api?.exportDataAsCsv({ fileName: `${exportFileName}.csv` });
    clearSelection();
  }
  function exportAllExcel() {
    exportRows(rows, undefined, "xlsx", "all");
  }
  function exportRows(sourceRows: Record<string, any>[], colIds: string[] | undefined, format: "csv" | "xlsx", suffix: string) {
    const cols = columnDefs
      .filter((c) => c.field && (!colIds || colIds.includes(c.field as string)) && isColumnVisible((c.colId || c.field) as string))
      .map((c) => ({ field: c.field as string, header: c.headerName || (c.field as string) }));
    const wsData = [cols.map((c) => c.header), ...sourceRows.map((r) => cols.map((c) => r[c.field] ?? ""))];
    if (format === "csv") {
      downloadCsv(`${exportFileName}-${suffix}.csv`, wsData.map((row) => row.map(String)));
    } else {
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${exportFileName}-${suffix}.xlsx`);
    }
    clearSelection();
  }

  // ── Shared "charts" submenu builder (used by both right-click and 3-dot menus) ──

  function buildChartsSubmenu(catField: string | undefined, numCols: NumericCol[], sourceRows: T[]): MenuNode[] {
    function leaf(label: string, family: ChartFamily, variant?: ChartVariant): MenuNode {
      const sel: ChartSelection = { family, variant, label };
      const disabled = !catField || sourceRows.length === 0 || numCols.length < minNumericFor(sel);
      return { label, disabled, onSelect: () => catField && openChartWindowRaw(sel, sourceRows, catField, numCols) };
    }
    return [
      { label: "Column", children: [leaf("Grouped", "column", "grouped"), leaf("Stacked", "column", "stacked"), leaf("100% Stacked", "column", "stacked100")] },
      { label: "Bar", children: [leaf("Grouped", "bar", "grouped"), leaf("Stacked", "bar", "stacked"), leaf("100% Stacked", "bar", "stacked100")] },
      { label: "Pie", children: [leaf("Pie", "pie"), leaf("Donut", "pie", "donut")] },
      leaf("Line", "line"),
      { label: "Area", children: [leaf("Grouped", "area", "grouped"), leaf("Stacked", "area", "stacked"), leaf("100% Stacked", "area", "stacked100")] },
      { label: "XY (Scatter)", children: [leaf("Scatter", "scatter"), leaf("Bubble", "scatter", "bubble")] },
      leaf("Combination", "combination"),
    ];
  }

  // ── Right-click menu: uses the drag range if the right-clicked cell is inside it, else just that row ──

  function buildContextMenuItems(): MenuNode[] {
    if (!contextMenu) return [];
    const inRange =
      selection && contextMenu.rowIndex != null && contextMenu.colId
        ? contextMenu.rowIndex >= selection.rowMin && contextMenu.rowIndex <= selection.rowMax && selection.colIds.includes(contextMenu.colId)
        : false;
    const useRange = inRange && hasMeaningfulRange(selection);

    const rangeRows = useRange ? getRowsForRange(selection!) : [contextMenu.rowData as T];
    const rangeNumericCols = useRange ? numericCols.filter((c) => selection!.colIds.includes(c.field)) : numericCols;
    const rangeCategoryField = useRange
      ? selection!.colIds.includes(categoryField || "")
        ? categoryField
        : (columnDefs.find((c) => c.field && selection!.colIds.includes(c.field as string) && c.cellDataType !== "number")?.field as string | undefined)
      : categoryField;

    const copyChildren: MenuNode[] = [
      { label: "Copy cell value", onSelect: copyCellValue },
      { label: "Copy row as JSON", onSelect: copyRowAsJson },
    ];
    if (useRange) copyChildren.push({ label: "Copy range as JSON", onSelect: () => copyRangeAsJson(rangeRows) });

    return [
      { label: "📋 Copy", children: copyChildren },
      { label: "📊 Charts", children: buildChartsSubmenu(rangeCategoryField, rangeNumericCols, rangeRows) },
      {
        label: "⬇ Export",
        children: [
          { label: useRange ? "Export range as CSV" : "Export row as CSV", onSelect: () => exportRows(rangeRows as any, useRange ? selection!.colIds : undefined, "csv", useRange ? "range" : "row") },
          { label: useRange ? "Export range as Excel" : "Export row as Excel", onSelect: () => exportRows(rangeRows as any, useRange ? selection!.colIds : undefined, "xlsx", useRange ? "range" : "row") },
        ],
      },
    ];
  }

  // ── Three-dot toolbar menu: same shape, driven entirely by the current drag range ──

  function buildToolbarMenuItems(): MenuNode[] {
    const rangeActive = hasMeaningfulRange(selection);
    const rangeRows = rangeActive ? getRowsForRange(selection!) : [];
    const rangeNumericCols = rangeActive ? numericCols.filter((c) => selection!.colIds.includes(c.field)) : [];
    const rangeCategoryField = rangeActive
      ? selection!.colIds.includes(categoryField || "")
        ? categoryField
        : (columnDefs.find((c) => c.field && selection!.colIds.includes(c.field as string) && c.cellDataType !== "number")?.field as string | undefined)
      : undefined;

    return [
      {
        label: "Manage columns",
        children: toggleableColumns.map((col) => ({
          label: `${isColumnVisible(col.colId) ? "☑" : "☐"} ${col.headerName}`,
          closeOnSelect: false,
          onSelect: () => toggleColumn(col.colId),
        })),
      },
      { label: "Auto size columns", onSelect: () => gridRef.current?.api?.autoSizeAllColumns() },
      { label: "Size columns to fit", onSelect: () => gridRef.current?.api?.sizeColumnsToFit() },
      { label: "⬇ Export all as CSV", onSelect: exportAllCsv },
      { label: "⬇ Export all as Excel", onSelect: exportAllExcel },
      ...(rangeActive
        ? [
            { label: "⬇ Export range as CSV", onSelect: () => exportRows(rangeRows, selection!.colIds, "csv", "range") },
            { label: "⬇ Export range as Excel", onSelect: () => exportRows(rangeRows, selection!.colIds, "xlsx", "range") },
          ]
        : []),
      { label: "📊 Chart range", disabled: !rangeActive, children: buildChartsSubmenu(rangeCategoryField, rangeNumericCols, rangeRows) },
    ];
  }

  function openToolbarMenu() {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setToolbarMenuPos({ x: Math.max(8, rect.right - MENU_WIDTH), y: rect.bottom + 6 });
  }

  // ── Render ────────────────────────────────────────────────────────────

  const rangeActiveForBar = hasMeaningfulRange(selection);

  return (
    <div style={{ width: "100%", position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      {/* ── Top toolbar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        {title && <span style={{ fontSize: 13, color: "#888" }}>{title}</span>}
        <div style={{ marginLeft: "auto" }}>
          <IconButton ref={menuButtonRef} size="small" onClick={openToolbarMenu} aria-label="Table options" sx={{ color: "#888", "&:hover": { color: "#eee" } }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      {/* ── Three-dot flyout menu ── */}
      {toolbarMenuPos && (
        <div ref={toolbarMenuRef}>
          <MenuLevel items={buildToolbarMenuItems()} x={toolbarMenuPos.x} y={toolbarMenuPos.y} onRequestClose={() => setToolbarMenuPos(null)} />
        </div>
      )}

      {/* ── AG Grid ── */}
      <div ref={gridWrapperRef} style={{ height, width: "100%", userSelect: draggingRef.current ? "none" : undefined }} onContextMenu={(e) => e.preventDefault()}>
        <AgGridReact<T>
          ref={gridRef}
          theme={appGridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellMouseDown={onCellMouseDown}
          onCellMouseOver={onCellMouseOver}
          onCellContextMenu={onCellContextMenu}
          getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
          popupParent={typeof document !== "undefined" ? document.body : undefined}
        />
      </div>

      {/* ── Right-click flyout menu ── */}
      {contextMenu && (
        <div ref={contextMenuRef}>
          <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, width: MENU_WIDTH, zIndex: 9999, background: "#161616", border: "1px solid #2a2a2a", borderBottom: "none", borderRadius: "6px 6px 0 0", padding: "6px 14px", fontSize: 11, color: "#666" }}>
            {contextMenu.cellValue || "—"}
          </div>
          <MenuLevel items={buildContextMenuItems()} x={contextMenu.x} y={contextMenu.y + 30} onRequestClose={() => setContextMenu(null)} />
        </div>
      )}

      {/* ── Floating action bar (appears while a drag range is active) ── */}
      {rangeActiveForBar && selection && (
        <div ref={rangeActionBarRef} style={{ position: "sticky", bottom: 12, margin: "8px 0 0", display: "flex", alignItems: "center", gap: 8, background: "#1a1a2e", border: "1px solid #2563eb", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#93c5fd", zIndex: 100 }}>
          <span style={{ fontWeight: 600 }}>{rangeLabel(selection)} selected</span>
          <span style={{ color: "#334155", margin: "0 4px" }}>|</span>

          {(["column", "line", "area", "pie"] as const).map((fam) => (
            <button
              key={fam}
              onClick={() => {
                const catField = selection.colIds.includes(categoryField || "") ? categoryField : (columnDefs.find((c) => c.field && selection.colIds.includes(c.field as string) && c.cellDataType !== "number")?.field as string | undefined);
                const numCols = numericCols.filter((c) => selection.colIds.includes(c.field));
                if (catField) openChartWindowRaw({ family: fam, variant: fam === "area" ? "stacked" : fam === "column" ? "grouped" : undefined, label: fam[0].toUpperCase() + fam.slice(1) }, getRowsForRange(selection), catField, numCols);
              }}
              style={quickBtnStyle}
            >
              {fam}
            </button>
          ))}

          <span style={{ color: "#334155", margin: "0 4px" }}>|</span>

          <button onClick={() => exportRows(getRowsForRange(selection), selection.colIds, "csv", "range")} style={quickBtnStyle}>CSV</button>
          <button onClick={() => exportRows(getRowsForRange(selection), selection.colIds, "xlsx", "range")} style={quickBtnStyle}>Excel</button>

          <button onClick={() => setSelection(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer" }}>✕ Clear</button>
        </div>
      )}

      {/* ── Floating, draggable, resizable chart windows ── */}
      {chartWindows.map((w) => (
        <FloatingChartWindow key={w.id} win={w} onClose={closeChartWindow} onUpdate={updateChartWindow} onFocus={focusChartWindow} />
      ))}
    </div>
  );
}

const quickBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  borderRadius: 4,
  color: "#93c5fd",
  fontSize: 12,
  padding: "2px 8px",
  cursor: "pointer",
};