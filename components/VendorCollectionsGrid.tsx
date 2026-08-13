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
  pendingCount: number;
  hasAnyPaid: boolean;
  collectionUrl: string;
};

function dueDateFormatter(params: { value: string }) {
  return params.value || "—";
}

export default function VendorCollectionsGrid({
  collections,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  collections: VendorCollection[];
  onEdit: (collectionId: string) => void;
  onDelete: (row: { id: string; title: string; hasAnyPaid: boolean }) => void;
  onCopyLink: (url: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const rows = useMemo<VendorCollectionRow[]>(
    () =>
      collections.map((c) => {
        const total = c.subscribers.length;
        const paidCount = c.subscribers.filter(
          (s) => s.payment?.status === "paid" || s.payment?.status === "confirmed"
        ).length;
        const confirmedCount = c.subscribers.filter((s) => s.payment?.status === "confirmed").length;
        const hasAnyPaid = c.subscribers.some((s) => !!s.payment);

        return {
          id: c.id,
          title: c.title,
          amountRupees: c.amountPaise / 100,
          dueDateLabel: c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "",
          totalSubscribers: total,
          paidCount,
          confirmedCount,
          pendingCount: total - paidCount,
          hasAnyPaid,
          collectionUrl: `${origin}/pay/${c.token}`,
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
        flex: 2,
        minWidth: 160,
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
        minWidth: 120,
        enableValue: false,
      },
      {
        headerName: "Subscribers",
        field: "totalSubscribers",
        type: "numericColumn",
        cellDataType: "number",
        minWidth: 110,
      },
      {
        headerName: "Paid",
        field: "paidCount",
        minWidth: 110,
        enableValue: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <span style={{ color: "#86efac" }}>
            {params.data.paidCount}/{params.data.totalSubscribers}
          </span>
        ),
      },
      {
        headerName: "Confirmed",
        field: "confirmedCount",
        type: "numericColumn",
        cellDataType: "number",
        minWidth: 100,
      },
      {
        headerName: "Pending",
        field: "pendingCount",
        minWidth: 100,
        enableValue: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <span style={{ color: params.data.pendingCount > 0 ? "#f87171" : "#888" }}>
            {params.data.pendingCount}
          </span>
        ),
      },
      {
        headerName: "Status",
        field: "hasAnyPaid",
        minWidth: 110,
        enableValue: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => (
          <span style={{ color: params.data.hasAnyPaid ? "#f59e0b" : "#93c5fd" }}>
            {params.data.hasAnyPaid ? "Locked" : "Editable"}
          </span>
        ),
      },
      {
        headerName: "Link",
        field: "collectionUrl",
        minWidth: 100,
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
        minWidth: 140,
        enableValue: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data: VendorCollectionRow }) => {
          const row = params.data;
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center", height: "100%" }}>
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
    [onEdit, onDelete, onCopyLink]
  );

  return <DataGrid<VendorCollectionRow> rows={rows} columnDefs={columnDefs} getRowId={(r) => r.id} height={360} />;
}