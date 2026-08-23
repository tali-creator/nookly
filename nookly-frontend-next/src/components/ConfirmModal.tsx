"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ConfirmInputConfig {
  label: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  input?: ConfirmInputConfig;
}

interface ConfirmResult {
  confirmed: boolean;
  value: string | null;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [value, setValue] = useState("");
  const [mounted, setMounted] = useState(false);
  const resolverRef = useRef<((r: ConfirmResult) => void) | null>(null);

  useEffect(() => setMounted(true), []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<ConfirmResult>((resolve) => {
      resolverRef.current = resolve;
      setValue(opts.input?.defaultValue ?? "");
      setDialog(opts);
    });
  }, []);

  const close = useCallback((result: ConfirmResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const inputInvalid = dialog?.input
    ? (dialog.input.required && value.trim() === "") ||
      (dialog.input.minLength != null && value.trim().length < dialog.input.minLength)
    : false;

  // Escape cancels, Enter confirms (when valid) while a dialog is open.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close({ confirmed: false, value: null });
      } else if (e.key === "Enter" && !inputInvalid && !dialog.input) {
        e.preventDefault();
        close({ confirmed: true, value: value.trim() || null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, inputInvalid, value, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {mounted && dialog
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => close({ confirmed: false, value: null })}
              />
              <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
                <h3 className="font-mono text-lg font-bold text-foreground">{dialog.title}</h3>
                {dialog.message ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {dialog.message}
                  </p>
                ) : null}
                {dialog.input ? (
                  <label className="mt-4 block text-sm font-semibold text-foreground">
                    {dialog.input.label}
                    <input
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={dialog.input.placeholder}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => close({ confirmed: false, value: null })}
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted"
                  >
                    {dialog.cancelLabel || "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={inputInvalid}
                    onClick={() => close({ confirmed: true, value: value.trim() || null })}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                      dialog.danger
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-primary hover:opacity-90"
                    }`}
                  >
                    {dialog.confirmLabel || "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmContext.Provider>
  );
}
