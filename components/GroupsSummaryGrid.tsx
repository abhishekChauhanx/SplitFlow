"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import DataGrid, { currencyFormatter, relativeDateFormatter } from "@/components/DataGrid";
import type { GroupSummaryRow } from "@/lib/dashboard-summary";

export default function GroupsSummaryGrid({ rows }: { rows: GroupSummaryRow[] }) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<GroupSummaryRow>[]>(
    () => [
      {
        headerName: "Group name",
        field: "groupName",
        pinned: "left",
        enableValue: false,
        minWidth: 160,
        cellRenderer: (params: any) => (
          <a
            href={`/groups/${params.data.groupId}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(`/groups/${params.data.groupId}`);
            }}
            style={{ color: "#60a5fa", textDecoration: "none", cursor: "pointer" }}
          >
            {params.value}
          </a>
        ),
      },
      { headerName: "My role", field: "myRole", width: 110, enableValue: false },
      { headerName: "Members", field: "totalMembers", width: 100, type: "numericColumn" },
      { headerName: "Total spending", field: "groupTotalSpending", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 150 },
      { headerName: "I paid", field: "iPaid", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "My fair share", field: "myFairShare", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 140 },
      { headerName: "Owed to me", field: "owedToMe", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "I still owe", field: "iStillOwe", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "Settled", field: "settledAmount", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Pending", field: "pendingAmount", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Disputed", field: "disputedAmount", type: "numericColumn", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Expenses", field: "totalExpenses", width: 110, type: "numericColumn" },
      { headerName: "Last activity", field: "lastActivity", valueFormatter: relativeDateFormatter, minWidth: 130, enableValue: false },
    ],
    [router]
  );

  return <DataGrid<GroupSummaryRow> rows={rows} columnDefs={columnDefs} getRowId={(r) => r.groupId} />;
}