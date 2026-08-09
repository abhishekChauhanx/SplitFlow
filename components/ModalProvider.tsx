"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ModalOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  mode?: "confirm" | "alert"; // "confirm" shows Cancel + Confirm, "alert" shows only OK
};

type ModalState = (ModalOptions & { resolve: (value: boolean) => void }) | null;

type PromptOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

type PromptState = (PromptOptions & { resolve: (value: string | null) => void }) | null;

const ModalContext = createContext<{
  confirm: (opts: ModalOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
} | null>(null);

function DialogIcon({ mode }: { mode: "confirm" | "alert" }) {
  // Question mark for confirm-style dialogs, info "i" for plain alerts
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: mode === "alert" ? "#2563eb" : "#f59e0b",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 16,
        flexShrink: 0,
      }}
    >
      {mode === "alert" ? "i" : "?"}
    </div>
  );
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [promptModal, setPromptModal] = useState<PromptState>(null);
  const [promptValue, setPromptValue] = useState("");
  const [promptError, setPromptError] = useState("");

  const confirm = useCallback((opts: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setModal({ ...opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(opts.defaultValue || "");
      setPromptError("");
      setPromptModal({ ...opts, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    modal?.resolve(result);
    setModal(null);
  }

  function handlePromptCancel() {
    promptModal?.resolve(null);
    setPromptModal(null);
  }

  function handlePromptSubmit() {
    if (promptModal?.required && !promptValue.trim()) {
      setPromptError("This field is required");
      return;
    }
    promptModal?.resolve(promptValue.trim());
    setPromptModal(null);
  }

  const mode = modal?.mode || "confirm";

  return (
    <ModalContext.Provider value={{ confirm, prompt }}>
      {children}

      {modal && (
        <div
          onClick={() => handleClose(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 90vw)",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #333",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              background: "#161616",
            }}
          >
            {/* ── Title bar ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)",
                borderBottom: "1px solid #2a2a2a",
              }}
            >
              <DialogIcon mode={mode} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>
                {modal.title || (mode === "alert" ? "Notice" : "Please confirm")}
              </span>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: "16px" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#ccc", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                {modal.message}
              </p>
            </div>

            {/* ── Footer ── */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 16px",
                background: "#141414",
                borderTop: "1px solid #2a2a2a",
              }}
            >
              {mode !== "alert" && (
                <button
                  onClick={() => handleClose(false)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    border: "1px solid #444",
                    background: "transparent",
                    color: "#ccc",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {modal.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {modal.confirmLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptModal && (
        <div
          onClick={handlePromptCancel}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 90vw)",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #333",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              background: "#161616",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)",
                borderBottom: "1px solid #2a2a2a",
              }}
            >
              <DialogIcon mode="confirm" />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>
                {promptModal.title || "Please provide details"}
              </span>
            </div>

            <div style={{ padding: "16px" }}>
              {promptModal.message && (
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
                  {promptModal.message}
                </p>
              )}
              <textarea
                autoFocus
                value={promptValue}
                onChange={(e) => {
                  setPromptValue(e.target.value);
                  setPromptError("");
                }}
                placeholder={promptModal.placeholder}
                rows={3}
                style={{
                  width: "100%",
                  background: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#eee",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {promptError && (
                <p style={{ color: "#f87171", fontSize: 12, margin: "6px 0 0" }}>{promptError}</p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 16px",
                background: "#141414",
                borderTop: "1px solid #2a2a2a",
              }}
            >
              <button
                onClick={handlePromptCancel}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid #444",
                  background: "transparent",
                  color: "#ccc",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {promptModal.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={handlePromptSubmit}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {promptModal.confirmLabel || "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used inside <ModalProvider>");
  return ctx;
}