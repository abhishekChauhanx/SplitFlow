"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import DataGrid, { currencyFormatter } from "@/components/DataGrid";

type RecurringTemplate = {
  id: string;
  description: string;
  amountPaise: number;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  frequencyDays: number;
  active: boolean;
  nextRunAt: string | null;
  pausedAt: string | null;
  nextCycleOverride?: {
    amountPaise: number;
    note?: string;
  } | null;
};

type RecurringRow = {
  id: string;
  description: string;
  amountRupees: number;
  splitType: string;
  frequencyLabel: string;
  active: boolean;
  nextRunLabel: string;
  hasOverride: boolean;
  overrideAmountRupees: number | null;
  overrideNote: string | undefined;
};

function nextRunFormatter(params: { value: string }) {
  return params.value || "—";
}

export default function GroupRecurringGrid({
  templates,
}: {
  templates: RecurringTemplate[];
}) {
  const rows = useMemo<RecurringRow[]>(
    () =>
      templates.map((t) => ({
        id: t.id,
        description: t.description,
        amountRupees: t.amountPaise / 100,
        splitType: t.splitType,
        frequencyLabel: `every ${t.frequencyDays}d`,
        active: t.active,
        nextRunLabel: t.active
          ? t.nextRunAt
            ? new Date(t.nextRunAt).toLocaleDateString()
            : "—"
          : t.pausedAt
          ? `since ${new Date(t.pausedAt).toLocaleDateString()}`
          : "—",
        hasOverride: !!t.nextCycleOverride,
        overrideAmountRupees: t.nextCycleOverride ? t.nextCycleOverride.amountPaise / 100 : null,
        overrideNote: t.nextCycleOverride?.note,
      })),
    [templates]
  );

  const columnDefs = useMemo<ColDef<RecurringRow>[]>(
    () => [
      {
        headerName: "Description",
        field: "description",
        cellDataType: "text",
        flex: 2,
        minWidth: 180,
        enableValue: false,
        cellRenderer: (params: { data: RecurringRow }) => {
          const row = params.data;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
              <span>{row.description}</span>
              {row.hasOverride && (
                <span
                  title={
                    row.overrideNote
                      ? `${row.overrideNote}${
                          row.overrideAmountRupees != null ? ` — ₹${row.overrideAmountRupees.toFixed(2)}` : ""
                        }`
                      : undefined
                  }
                  style={{
                    fontSize: 11,
                    color: "#93c5fd",
                    border: "1px solid #1e40af",
                    borderRadius: 4,
                    padding: "1px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ override next cycle
                </span>
              )}
            </div>
          );
        },
      },
      {
        headerName: "Amount",
        field: "amountRupees",
        type: "numericColumn",
        cellDataType: "number",
        valueFormatter: currencyFormatter,
        minWidth: 120,
      },
      { headerName: "Split", field: "splitType", width: 120, enableValue: false },
      { headerName: "Frequency", field: "frequencyLabel", width: 120, enableValue: false },
      {
        headerName: "Status",
        field: "active",
        width: 110,
        enableValue: false,
        cellRenderer: (params: { data: RecurringRow }) => (
          <span style={{ color: params.data.active ? "#86efac" : "#f59e0b" }}>
            {params.data.active ? "Active" : "Paused"}
          </span>
        ),
      },
      {
        headerName: "Next run",
        field: "nextRunLabel",
        valueFormatter: nextRunFormatter,
        minWidth: 150,
        enableValue: false,
      },
    ],
    []
  );

  return <DataGrid<RecurringRow> rows={rows} columnDefs={columnDefs} getRowId={(r) => r.id} height={320} />;
}