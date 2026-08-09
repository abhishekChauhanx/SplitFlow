"use client";

import { useMemo, useRef, useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MoreVertIcon from "@mui/icons-material/MoreVert";

// Registered once at module load, shared by every table that uses this component.
ModuleRegistry.registerModules([
  AllCommunityModule,
  RangeSelectionModule,
  ContextMenuModule,
  AggregationModule,
  IntegratedChartsModule.with(AgChartsCommunityModule),
]);

if (process.env.NODE_ENV !== "production") {
  enableDevValidations();
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

// Shared dark styling for the MUI popovers, so they match the rest of the app
// instead of MUI's default light theme.
const menuPaperSx = {
  backgroundColor: "#161616",
  color: "#eee",
  border: "1px solid #2a2a2a",
  minWidth: 200,
};
const menuItemSx = {
  fontSize: 13,
  "&:hover": { backgroundColor: "#1f1f1f" },
};

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
  const gridRef = useRef<AgGridReact<T>>(null);

  // Both menus anchor to this persistent button ref — never to a MenuItem,
  // since MenuItems unmount when their parent Menu closes, which leaves a
  // stale/detached anchor and makes MUI fall back to positioning at (0, 0).
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [openMenu, setOpenMenu] = useState<null | "main" | "columns">(null);

  // Which columns are currently visible — keyed by colId (defaults to `field`
  // when a colDef doesn't set an explicit colId). Starts all-visible.
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      enableValue: true, // numeric columns are chart-able by default; opt individual columns out as needed
    }),
    []
  );

  const toggleableColumns = useMemo(
    () =>
      columnDefs
        .filter((c) => c.colId || c.field) // skip columns with neither (can't target them)
        .map((c) => ({
          colId: (c.colId || (c.field as string))!,
          headerName: c.headerName || (c.field as string) || "",
        })),
    [columnDefs]
  );

  function isColumnVisible(colId: string) {
    return columnVisibility[colId] !== false; // default true until toggled off
  }

  function toggleColumn(colId: string) {
    const nextVisible = !isColumnVisible(colId);
    gridRef.current?.api?.setColumnsVisible([colId], nextVisible);
    setColumnVisibility((prev) => ({ ...prev, [colId]: nextVisible }));
  }

  function handleAutoSizeColumns() {
    gridRef.current?.api?.autoSizeAllColumns();
    setOpenMenu(null);
  }

  function handleSizeColumnsToFit() {
    gridRef.current?.api?.sizeColumnsToFit();
    setOpenMenu(null);
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <IconButton
          ref={menuButtonRef}
          size="small"
          onClick={() => setOpenMenu("main")}
          aria-label="Table options"
          sx={{ color: "#888", "&:hover": { color: "#eee" } }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>

        <Menu
          anchorEl={menuButtonRef.current}
          open={openMenu === "main"}
          onClose={() => setOpenMenu(null)}
          slotProps={{ paper: { sx: menuPaperSx } }}
        >
          <MenuItem sx={menuItemSx} onClick={() => setOpenMenu("columns")}>
            Manage columns
          </MenuItem>
          <Divider sx={{ borderColor: "#2a2a2a" }} />
          <MenuItem sx={menuItemSx} onClick={handleAutoSizeColumns}>
            Auto size columns
          </MenuItem>
          <MenuItem sx={menuItemSx} onClick={handleSizeColumnsToFit}>
            Size columns to fit
          </MenuItem>
        </Menu>

        <Menu
          anchorEl={menuButtonRef.current}
          open={openMenu === "columns"}
          onClose={() => setOpenMenu(null)}
          slotProps={{ paper: { sx: menuPaperSx } }}
        >
          {toggleableColumns.map((col) => (
            <MenuItem
              key={col.colId}
              sx={menuItemSx}
              onClick={() => toggleColumn(col.colId)}
              dense
            >
              <Checkbox
                checked={isColumnVisible(col.colId)}
                size="small"
                sx={{
                  color: "#555",
                  "&.Mui-checked": { color: "#2563eb" },
                  padding: "4px 8px 4px 0",
                }}
              />
              <ListItemText primary={col.headerName} />
            </MenuItem>
          ))}
        </Menu>
      </div>

      <div style={{ height, width: "100%" }}>
        <AgGridReact<T>
          ref={gridRef}
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
    </div>
  );
}