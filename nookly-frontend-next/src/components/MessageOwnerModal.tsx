"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";

interface Msg {
  id: string;
  senderType: string;
  text: string;
  createdAt: string;
}

export default function MessageOwnerModal({
  businessId,
  businessName,
  open,
  onClose,
}: {
  businessId: string;
  businessName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function loadMessages(id: string) {
    try {
      const r = await apiGet<{ messages: Msg[] }>(
        `/conversations/${id}/messages?deviceId=${getDeviceId()}`
      );
      setMessages(r.data.messages || []);
    } catch {
      /* ignore */
    }
  }

  // On open, look for an existing thread for this device+business.
  useEffect(() => {
    if (!open) return;
    setConvId(null);
    setMessages([]);
    setText("");
    let cancelled = false;
    (async () => {
      try {
        const r = await apiGet<{ conversation: { id: string } }>(
          `/conversations/mine?businessId=${businessId}&deviceId=${getDeviceId()}`
        );
        if (cancelled) return;
        setConvId(r.data.conversation.id);
        await loadMessages(r.data.conversation.id);
      } catch {
        /* no existing thread yet — created on first send */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      if (!convId) {
        const r = await apiPost<{ conversation: { id: string } }>("/conversations", {
          businessId,
          deviceId: getDeviceId(),
          initialMessage: t,
        });
        setConvId(r.data.conversation.id);
        await loadMessages(r.data.conversation.id);
      } else {
        await apiPost(`/conversations/${convId}/messages`, {
          text: t,
          deviceId: getDeviceId(),
        });
        await loadMessages(convId);
      }
      setText("");
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-mono text-lg font-bold">Message {businessName}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <svg className="size-4">
              <use href="#i-x" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation with this business owner.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={m.senderType === "CUSTOMER" ? "text-right" : "text-left"}
              >
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.senderType === "CUSTOMER"
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.text}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message…"
            rows={2}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !text.trim()}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
