"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ModalOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  mode?: "confirm" | "alert";
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

export type FormField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string; // "text" | "email" | "tel" | ...
};

type FormOptions = {
  title?: string;
  message?: string;
  fields: FormField[];
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValues?: Record<string, string>;
};

type FormState = (FormOptions & { resolve: (value: Record<string, string> | null) => void }) | null;

const ModalContext = createContext<{
  confirm: (opts: ModalOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  promptForm: (opts: FormOptions) => Promise<Record<string, string> | null>;
} | null>(null);

function DialogIcon({ mode }: { mode: "confirm" | "alert" }) {
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

  const [formModal, setFormModal] = useState<FormState>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

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

  const promptForm = useCallback((opts: FormOptions) => {
    return new Promise<Record<string, string> | null>((resolve) => {
      const initial: Record<string, string> = {};
      for (const f of opts.fields) initial[f.key] = opts.defaultValues?.[f.key] || "";
      setFormValues(initial);
      setFormError("");
      setFormModal({ ...opts, resolve });
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

  function handleFormCancel() {
    formModal?.resolve(null);
    setFormModal(null);
  }

  function handleFormSubmit() {
    if (!formModal) return;
    for (const f of formModal.fields) {
      if (f.required && !formValues[f.key]?.trim()) {
        setFormError(`${f.label} is required`);
        return;
      }
    }
    const trimmed: Record<string, string> = {};
    for (const f of formModal.fields) trimmed[f.key] = (formValues[f.key] || "").trim();
    formModal.resolve(trimmed);
    setFormModal(null);
  }

  const mode = modal?.mode || "confirm";

  return (
    <ModalContext.Provider value={{ confirm, prompt, promptForm }}>
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

            <div style={{ padding: "16px" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#ccc", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                {modal.message}
              </p>
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

      {formModal && (
        <div
          onClick={handleFormCancel}
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
                {formModal.title || "Please provide details"}
              </span>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {formModal.message && (
                <p style={{ margin: "0 0 4px", fontSize: 14, color: "#ccc", lineHeight: 1.5 }}>
                  {formModal.message}
                </p>
              )}
              {formModal.fields.map((f) => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
                    {f.label}{f.required ? " *" : ""}
                  </label>
                  <input
                    autoFocus={f === formModal.fields[0]}
                    type={f.type || "text"}
                    value={formValues[f.key] || ""}
                    onChange={(e) => {
                      setFormValues({ ...formValues, [f.key]: e.target.value });
                      setFormError("");
                    }}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "#0f0f0f",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "#eee",
                      fontSize: 14,
                    }}
                  />
                </div>
              ))}
              {formError && (
                <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{formError}</p>
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
                onClick={handleFormCancel}
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
                {formModal.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={handleFormSubmit}
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
                {formModal.confirmLabel || "Submit"}
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