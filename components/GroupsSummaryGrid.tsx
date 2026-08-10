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
        cellDataType: "text",
        pinned: "left",
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
      { headerName: "My role", field: "myRole", cellDataType: "text", width: 110 },
      { headerName: "Members", field: "totalMembers", cellDataType: "number", width: 100 },
      { headerName: "Total spending", field: "groupTotalSpending", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 150 },
      { headerName: "I paid", field: "iPaid", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "My fair share", field: "myFairShare", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 140 },
      { headerName: "Owed to me", field: "owedToMe", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "I still owe", field: "iStillOwe", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "Settled", field: "settledAmount", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Pending", field: "pendingAmount", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Disputed", field: "disputedAmount", cellDataType: "number", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Expenses", field: "totalExpenses", cellDataType: "number", width: 110 },
      { headerName: "Last activity", field: "lastActivity", valueFormatter: relativeDateFormatter, minWidth: 130 },
    ],
    [router]
  );

  return (
    <DataGrid<GroupSummaryRow>
      rows={rows}
      columnDefs={columnDefs}
      getRowId={(r) => r.groupId}
      exportFileName="groups-summary"
      title="Groups summary"
    />
  );
}