"use client";

/* Owner messages — port 1:1 from nookly-frontend/owner/messages.html. */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MarketplaceShell from "@/components/MarketplaceShell";
import { apiGet, apiPost } from "@/lib/api";
import { getToken, ensureSeedFromQuery } from "@/lib/auth";
import { connectAsUser, type IoSocket } from "@/lib/socketClient";
import type { ConversationMessage, OwnerConversation } from "@/lib/types";

function timeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (isNaN(diff)) return "";
  if (diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MessagesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const focusBusinessId = params.get("businessId");

  const [conversations, setConversations] = useState<OwnerConversation[] | null>(null);
  const [convError, setConvError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [threadError, setThreadError] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<IoSocket | null>(null);

  useEffect(() => {
    ensureSeedFromQuery();
    if (!getToken()) {
      router.replace("/owner/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadInbox = useCallback(async () => {
    setConvError("");
    try {
      const { data } = await apiGet<{ conversations: OwnerConversation[] }>(
        "/conversations/owner"
      );
      setConversations(data.conversations || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setConvError("Could not load conversations. " + (err.message || ""));
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    // eslint-disable-next-line react-hooks/ex-state-in-effect
    loadInbox();
  }, [loadInbox]);

  // Live updates: connect as the owner and append messages pushed to the socket.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let socket: IoSocket | null = null;
    let cancelled = false;
    (async () => {
      try {
        socket = await connectAsUser(token);
        socketRef.current = socket;
        socket.on("conversation:message", (...args: unknown[]) => {
          const payload = args[0] as {
            conversationId?: string;
            message?: ConversationMessage;
          };
          const msg = payload?.message;
          if (!msg || !activeId || payload?.conversationId !== activeId) return;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        });
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [activeId]);

  async function openThread(conversationId: string) {
    setActiveId(conversationId);
    setThreadError(false);
    setMessages([]);
    setReply("");
    const c = (conversations || []).find((x) => x.id === conversationId);
    setActiveName(c ? c.businessName : "Conversation");
    try {
      const { data } = await apiGet<{ messages: ConversationMessage[] }>(
        "/conversations/" + conversationId + "/messages",
        { noCache: true }
      );
      setMessages(data.messages || []);
    } catch {
      setThreadError(true);
    }
  }

  /* Auto-open the thread matching ?businessId= once the inbox is loaded. */
  useEffect(() => {
    if (!focusBusinessId || !conversations) return;
    const match = conversations.find((c) => c.businessId === focusBusinessId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) openThread(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBusinessId, conversations]);

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !activeId) return;
    setReply("");
    setMessages((prev) => [
      ...prev,
      { id: "optimistic-" + Date.now(), text, senderType: "OWNER", createdAt: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      await apiPost("/conversations/" + activeId + "/messages", { text });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  function closeThread() {
    setActiveId(null);
    loadInbox();
  }

  return (
    <MarketplaceShell active="messages">
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Your Nookly
          </p>
          <h1 className="font-mono text-4xl font-bold tracking-[-0.06em]">Messages</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Conversations from customers who found your businesses. Reply here to keep the
            thread going.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {!activeId && (
            <div className="flex flex-col gap-3">
              {convError ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  {convError}
                </div>
              ) : conversations === null ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  Loading conversations…
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                  No customer conversations yet. When someone messages you about a listing,
                  their thread appears here.
                </div>
              ) : (
                conversations.map((c) => {
                  const last = c.lastMessage;
                  const previewText = last
                    ? (last.senderType === "OWNER" ? "You: " : "") +
                      (last.text.length > 90 ? last.text.slice(0, 90) + "…" : last.text)
                    : null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition hover:shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-mono text-lg font-bold">{c.businessName}</h3>
                          {c.unread > 0 ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                              {c.unread}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {previewText ?? (
                            <span className="italic">No messages yet</span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {last ? timeLabel(last.createdAt) : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => openThread(c.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeId && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeThread}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary"
                  >
                    &larr; Inbox
                  </button>
                  <h2 className="font-mono text-xl font-bold">{activeName}</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Customers message you here
                </span>
              </div>
              <div
                ref={scrollRef}
                className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto p-5"
              >
                {threadError ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Could not load this conversation.
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Say hi — start the conversation with a friendly reply.
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderType === "OWNER";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            mine
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-muted text-foreground"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                onSubmit={submitReply}
                className="flex items-center gap-3 border-t border-border p-4"
              >
                <input
                  type="text"
                  autoComplete="off"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to this customer…"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Send reply"
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90"
                >
                  <svg className="size-5" aria-hidden="true">
                    <use href="#i-arrow-up-right" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </MarketplaceShell>
  );
}

export default function MessagesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense>
        <MessagesInner />
      </Suspense>
    </main>
  );
}
