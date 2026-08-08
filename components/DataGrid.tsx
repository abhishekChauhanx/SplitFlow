"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  enableDevValidations,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import {
  RangeSelectionModule,
  IntegratedChartsModule,
  ContextMenuModule,
  AggregationModule,
} from "ag-grid-enterprise";
import { AgChartsCommunityModule } from "ag-charts-community";

ModuleRegistry.registerModules([
  AllCommunityModule,
  RangeSelectionModule,
  ContextMenuModule,
  AggregationModule,
  IntegratedChartsModule.with(AgChartsCommunityModule),
]);

// Turns on AG Grid's full dev-time error/warning messages instead of terse
// error codes — dev builds only, so it never ships to production.
if (process.env.NODE_ENV !== "production") {
  enableDevValidations();
}
const originalError = console.error;
if (process.env.NODE_ENV !== "production") {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("AG Grid Enterprise") ||
        args[0].includes("License Key Not Found") ||
        args[0].includes("trial license key") ||
        /^\*+$/.test(args[0].trim()))
    ) {
      return;
    }
    originalError(...args);
  };
}
// Dark theme matching the app, shared by every table.
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

// Reusable formatters — any table's columnDefs can import and use these.
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

type DataGridProps<T> = {
  rows: T[];
  columnDefs: ColDef<T>[];
  height?: number;
  getRowId?: (row: T) => string;
};

export default function DataGrid<T>({ rows, columnDefs, height = 420, getRowId }: DataGridProps<T>) {
  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      enableValue: true, // numeric columns are chart-able by default; opt individual columns out as needed
    }),
    []
  );

  return (
    <div style={{ height, width: "100%" }}>
      <AgGridReact<T>
        theme={appGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        cellSelection={true}
        enableCharts={true}
        getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
        popupParent={typeof document !== "undefined" ? document.body : undefined}
      />
    </div>
  );
}