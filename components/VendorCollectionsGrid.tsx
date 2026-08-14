"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import DataGrid, { currencyFormatter } from "@/components/DataGrid";

type VendorSubscriber = {
  id: string;
  name: string;
  email?: string | null;
  payment?: { status: string } | null;
};

type VendorCollection = {
  id: string;
  title: string;
  amountPaise: number;
  dueDate: string | null;
  token: string;
  subscribers: VendorSubscriber[];
};

type VendorCollectionRow = {
  id: string;
  title: string;
  amountRupees: number;
  dueDateLabel: string;
  totalSubscribers: number;
  paidCount: number;
  confirmedCount: number;
  awaitingConfirmationCount: number;
  pendingCount: number;
  hasAnyPaid: boolean;
  collectionUrl: string;
  paidNames: string;
  pendingNames: string;
};

function dueDateFormatter(params: { value: string }) {
  return params.value || "—";
}

export default function VendorCollectionsGrid({
  collections,
  onEdit,
  onDelete,
  onView,
  onCopyLink,
}: {
  collections: VendorCollection[];
  onEdit: (collectionId: string) => void;
  onDelete: (row: { id: string; title: string; hasAnyPaid: boolean }) => void;
  onView: (collectionId: string) => void;
  onCopyLink: (url: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const rows = useMemo<VendorCollectionRow[]>(
    () =>
      collections.map((c) => {
        const total = c.subscribers.length;
        const paidSubs = c.subscribers.filter(
          (s) => s.payment?.status === "paid" || s.payment?.status === "confirmed"
        );
        const pendingSubs = c.subscribers.filter((s) => !s.payment);
        const confirmedCount = c.subscribers.filter((s) => s.payment?.status === "confirmed").length;
        const hasAnyPaid = c.subscribers.some((s) => !!s.payment);

        return {
          id: c.id,
          title: c.title,
          amountRupees: c.amountPaise / 100,
          dueDateLabel: c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "",
          totalSubscribers: total,
          paidCount: paidSubs.length,
          confirmedCount,
          awaitingConfirmationCount: paidSubs.length - confirmedCount,
          pendingCount: pendingSubs.length,
          hasAnyPaid,
          collectionUrl: `${origin}/pay/${c.token}`,
          paidNames: paidSubs.map((s) => s.name).join(", ") || "—",
          pendingNames: pendingSubs.map((s) => s.name).join(", ") || "—",
        };
      }),
    [collections, origin]
  );

  const columnDefs = useMemo<ColDef<VendorCollectionRow>[]>(
    () => [
      {
        headerName: "Title",
        field: "title",
        cellDataType: "text",
        flex: 1.5,
        minWidth: 150,
        enableValue: false,
      },
      {
        headerName: "Amount / person",
        field: "amountRupees",
        type: "numericColumn",
        cellDataType: "number",
        valueFormatter: currencyFormatter,
        minWidth: 130,
      },
      {
        headerName: "Due date",
        field: "dueDateLabel",
        valueFormatter: dueDateFormatter,
        minWidth: 110,
        enableValue: false,
      },
      {
        headerName: "Subscribers",
        field: "totalSubscribers",
        type: "numericColumn",
        cellDataType: "number",
        minWidth: 100,
      },
      {
        headerName: "Paid",
        field: "paidCount",
        minWidth: 90,
        enableValue: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <span style={{ color: "#86efac" }}>
            {params.data.paidCount}/{params.data.totalSubscribers}
          </span>
        ),
      },
      {
        headerName: "Who paid",
        field: "paidNames",
        cellDataType: "text",
        flex: 2,
        minWidth: 200,
        enableValue: false,
        tooltipField: "paidNames",
        cellStyle: { color: "#86efac" },
      },
      {
        headerName: "Who hasn't paid",
        field: "pendingNames",
        cellDataType: "text",
        flex: 2,
        minWidth: 200,
        enableValue: false,
        tooltipField: "pendingNames",
        cellStyle: { color: "#f87171" },
      },
      {
        headerName: "Confirmed",
        field: "confirmedCount",
        type: "numericColumn",
        cellDataType: "number",
        minWidth: 100,
      },
      {
        headerName: "Awaiting confirm",
        field: "awaitingConfirmationCount",
        minWidth: 130,
        enableValue: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <span style={{ color: params.data.awaitingConfirmationCount > 0 ? "#f59e0b" : "#888" }}>
            {params.data.awaitingConfirmationCount}
          </span>
        ),
      },
      {
        headerName: "Link",
        field: "collectionUrl",
        minWidth: 90,
        enableValue: false,
        sortable: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <button
            onClick={() => onCopyLink(params.data.collectionUrl)}
            style={{ fontSize: 12, background: "#1e40af", color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
          >
            Copy
          </button>
        ),
      },
      {
        headerName: "Actions",
        field: "id",
        minWidth: 190,
        enableValue: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => {
          const row = params.data;
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center", height: "100%" }}>
              <button
                onClick={() => onView(row.id)}
                style={{ fontSize: 12, color: "#93c5fd", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                View
              </button>
              <button
                onClick={() => onEdit(row.id)}
                style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete({ id: row.id, title: row.title, hasAnyPaid: row.hasAnyPaid })}
                disabled={row.hasAnyPaid}
                title={row.hasAnyPaid ? "Can't delete — payments already recorded" : "Delete collection"}
                style={{
                  fontSize: 12,
                  color: row.hasAnyPaid ? "#555" : "#f87171",
                  background: "none",
                  border: "none",
                  cursor: row.hasAnyPaid ? "not-allowed" : "pointer",
                  padding: 0,
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [onEdit, onDelete, onView, onCopyLink]
  );

  return (
    <div style={{ width: "100%" }}>
      <DataGrid<VendorCollectionRow> rows={rows} columnDefs={columnDefs} getRowId={(r) => r.id} height={360} />
    </div>
  );
}