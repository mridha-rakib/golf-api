import { useEffect, useMemo, useRef, useState } from "react";
import { api, normalizeToken, setToken } from "./api";
import { createSocket } from "./socket";

type Golfer = { _id: string; fullName?: string; email?: string };
type FollowingItem = { golfer: Golfer; isFollowing: boolean };
type ClubRosterItem = { golferId: string; user: Golfer };
type Thread = {
  _id: string;
  type: "direct" | "group";
  name?: string | null;
  memberUserIds: string[];
  lastMessage?: any;
  directPeer?: Golfer | null;
};

type Message = {
  _id: string;
  senderUserId: string;
  text?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

const appCss = `
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap");

:root {
  --bg: #0b1020;
  --panel: rgba(12, 18, 32, 0.85);
  --panel-strong: rgba(17, 27, 48, 0.95);
  --text: #e6ecfb;
  --muted: #9aa7c7;
  --accent: #3aa1ff;
  --accent-2: #4ce1c1;
  --border: rgba(255, 255, 255, 0.08);
  --bubble-me: linear-gradient(135deg, #3aa1ff 0%, #1f6feb 100%);
  --bubble-them: #172238;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
  font-family: "Space Grotesk", "DM Sans", sans-serif;
  background:
    radial-gradient(900px circle at 12% -10%, rgba(58, 161, 255, 0.25), transparent 55%),
    radial-gradient(900px circle at 110% 10%, rgba(76, 225, 193, 0.2), transparent 55%),
    var(--bg);
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-mark {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3aa1ff 0%, #4ce1c1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.logo-mark svg {
  width: 24px;
  height: 24px;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.brand-subtitle {
  font-size: 12px;
  color: var(--muted);
}

.status-pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(58, 161, 255, 0.15);
  border: 1px solid rgba(58, 161, 255, 0.35);
  font-size: 12px;
  color: var(--text);
}

.columns {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  gap: 18px;
}

.sidebar,
.main,
.side-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
}

.panel-note {
  font-size: 12px;
  color: var(--muted);
}

.input,
.textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #0b1324;
  color: var(--text);
  font-family: "DM Sans", sans-serif;
}

.textarea {
  min-height: 74px;
  resize: vertical;
}

.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 9px 14px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #051021;
  font-weight: 600;
  cursor: pointer;
}

.btn.secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.list {
  max-height: 220px;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(8, 12, 22, 0.7);
}

.list-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item.selected {
  background: rgba(58, 161, 255, 0.18);
}

.list-title {
  font-weight: 600;
}

.list-subtitle {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.list-item.muted {
  cursor: default;
  color: var(--muted);
}

.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 560px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-title {
  font-size: 18px;
  font-weight: 600;
}

.chat-subtitle {
  font-size: 12px;
  color: var(--muted);
}

.chat-scroll {
  flex: 1;
  max-height: 520px;
  overflow: auto;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: #0b1324;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}

.message-row.me {
  justify-content: flex-end;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: #162235;
  color: var(--muted);
}

.avatar.me {
  background: linear-gradient(135deg, #3aa1ff 0%, #4ce1c1 100%);
  color: #051021;
}

.message-block {
  max-width: 72%;
}

.message-meta {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}

.message-meta.me {
  text-align: right;
}

.bubble {
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bubble-them);
}

.bubble.me {
  border: none;
  background: var(--bubble-me);
  color: #051021;
}

.message-text {
  white-space: pre-wrap;
  line-height: 1.4;
}

.message-media {
  margin-top: 8px;
  border-radius: 12px;
  max-width: 240px;
  display: block;
  border: 1px solid var(--border);
}

.input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--muted);
}

.log-list {
  max-height: 200px;
  overflow: auto;
  font-size: 12px;
  color: var(--muted);
}

.log-item {
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
}

.log-item:last-child {
  border-bottom: none;
}

.checkbox-list label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .columns {
    grid-template-columns: 1fr;
  }

  .chat-panel {
    min-height: unset;
  }
}
`;

export default function App() {
  const [token, setJwt] = useState("");
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState<FollowingItem[]>([]);
  const [clubRoster, setClubRoster] = useState<Golfer[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Golfer | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const selectedThreadRef = useRef<Thread | null>(null);
  const [joinedThreadId, setJoinedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const rawToken = useMemo(() => normalizeToken(token), [token]);
  const socket = useMemo(
    () => (rawToken ? createSocket(rawToken) : null),
    [rawToken],
  );

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    if (!socket) return;
    const add = (m: string) => setLog((l) => [...l.slice(-80), m]);
    socket.on("connect", () => add("socket connected"));
    socket.on("connect_error", (e) => add(`connect_error: ${e.message}`));
    socket.on("new-msg", (p) => {
      add(
        `[${p.convId}] ${p.senderId}: ${
          p.text ?? (p.mediaUrls?.[0] || "[media]")
        }`,
      );
      setMessages((prev) => {
        const current = selectedThreadRef.current;
        if (!current || p.convId !== current._id) {
          return prev;
        }
        if (prev.some((m) => m._id === p.id || m._id === p.tempId)) {
          return prev;
        }
        return [
          ...prev,
          {
            _id: p.id ?? p.tempId ?? `tmp-${Date.now()}`,
            senderUserId: p.senderId,
            text: p.text,
            imageUrl: p.mediaUrls?.[0] ?? null,
            createdAt: p.sentAt ?? new Date().toISOString(),
          },
        ];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !selectedThread?._id) return;
    setJoinedThreadId(null);
    socket.emit("join", { convId: selectedThread._id }, (resp: any) => {
      setLog((l) => [
        ...l.slice(-80),
        resp?.ok
          ? `joined ${selectedThread._id}`
          : `join failed: ${resp?.error}`,
      ]);
      if (resp?.ok) {
        setJoinedThreadId(selectedThread._id);
      }
    });
  }, [socket, selectedThread]);

  const parseJwt = (jwt: string) => {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    try {
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = payload + "===".slice((payload.length + 3) % 4);
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!rawToken) {
      setViewerRole(null);
      setViewerUserId(null);
      return;
    }
    const payload = parseJwt(rawToken);
    setViewerRole(payload?.role ?? null);
    setViewerUserId(
      payload?.userId ?? payload?._id ?? payload?.id ?? payload?.sub ?? null,
    );
  }, [rawToken]);

  const userDirectory = useMemo(() => {
    const map = new Map<string, Golfer>();
    following.forEach((f) => map.set(f.golfer._id, f.golfer));
    clubRoster.forEach((m) => map.set(m._id, m));
    threads.forEach((t) => {
      if (t.directPeer?._id) {
        map.set(t.directPeer._id, t.directPeer);
      }
    });
    if (viewerUserId) {
      map.set(viewerUserId, { _id: viewerUserId, fullName: "You" });
    }
    return map;
  }, [following, clubRoster, threads, viewerUserId]);

  const getDisplayName = (id?: string | null) => {
    if (!id) return "Unknown";
    if (id === "me") return "You";
    const user = userDirectory.get(id);
    return user?.fullName || user?.email || `User ${id.slice(-6)}`;
  };

  const getInitials = (label: string) => {
    const cleaned = label.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
    if (!cleaned) return "?";
    const parts = cleaned.split(/\s+/).slice(0, 2);
    const letters = parts.map((p) => p[0]).join("");
    return letters.toUpperCase();
  };

  const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const loadFollowing = async () => {
    if (!token.trim()) return;
    setToken(token.trim());

    if (viewerRole === "golf_club") {
      const res = await api.get("/golf-clubs/me/roles");
      const managers: ClubRosterItem[] = res.data.data?.managers ?? [];
      const members: ClubRosterItem[] = res.data.data?.members ?? [];
      const roster = [...managers, ...members]
        .map((entry) => entry.user)
        .filter(Boolean);
      setClubRoster(roster);
      setFollowing([]);
      return;
    }

    const res = await api.get("/social-feed/golfers/following", {
      params: { page: 1, limit: 50 },
    });
    setFollowing(res.data.data ?? []);
    setClubRoster([]);
  };

  const loadThreads = async () => {
    if (!token.trim()) return;
    setToken(token.trim());
    const res = await api.get("/chat/threads");
    setThreads(res.data.data ?? res.data ?? []);
  };

  const loadMessages = async (threadId: string) => {
    if (!token.trim()) return;
    setToken(token.trim());
    try {
      setMessagesError(null);
      const res = await api.get(`/chat/threads/${threadId}/messages`, {
        params: { page: 1, limit: 50 },
      });
      const raw = res.data?.data ?? res.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.messages)
          ? raw.messages
          : [];
      if (!Array.isArray(raw)) {
        setLog((l) => [
          ...l.slice(-80),
          "load messages: unexpected payload shape",
        ]);
      }
      setMessages(
        data
          .map((m: any) => ({
            _id: m._id,
            senderUserId: m.senderUserId,
            text: m.text,
            imageUrl: m.imageUrl,
            createdAt: m.createdAt,
          })),
      );
      setLog((l) => [...l.slice(-80), `loaded ${data.length} messages`]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setMessages([]);
      setMessagesError(msg);
      setLog((l) => [...l.slice(-80), `load messages error: ${msg}`]);
    }
  };

  const sendMessage = async () => {
    if (!socket || !selectedThread || !text.trim()) return;
    const trimmed = text.trim();
    const tempId = `tmp-${Date.now()}`;

    if (joinedThreadId !== selectedThread._id) {
      const joined = await new Promise<boolean>((resolve) => {
        socket.emit("join", { convId: selectedThread._id }, (resp: any) =>
          resolve(Boolean(resp?.ok)),
        );
      });
      if (!joined) {
        setLog((l) => [
          ...l.slice(-80),
          "send aborted: failed to join thread",
        ]);
        return;
      }
      setJoinedThreadId(selectedThread._id);
    }

    setText("");
    setMessages((msgs) => [
      ...msgs,
      {
        _id: tempId,
        senderUserId: viewerUserId ?? "me",
        text: trimmed,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    socket.emit(
      "send-msg",
      { convId: selectedThread._id, text: trimmed, tempId },
      async (resp: any) => {
        if (!resp?.ok) {
          setMessages((msgs) => msgs.filter((m) => m._id !== tempId));
          setLog((l) => [
            ...l.slice(-80),
            `send error: ${resp?.error ?? resp}`,
          ]);
          return;
        }
        if (resp?.message?.id) {
          setMessages((msgs) =>
            msgs.map((m) =>
              m._id === tempId
                ? {
                    ...m,
                    _id: resp.message.id,
                    senderUserId: resp.message.senderId ?? m.senderUserId,
                    text: resp.message.text ?? m.text,
                  }
                : m,
            ),
          );
        }
        setLog((l) => [...l.slice(-80), "sent"]);
        await loadMessages(selectedThread._id);
      },
    );
  };

  const toggleMember = (id: string) =>
    setGroupMembers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createGroup = async () => {
    if (!token.trim() || !groupName.trim()) return;
    setToken(token.trim());
    const payload: any = { name: groupName.trim() };
    if (viewerRole !== "golf_club") {
      payload.memberUserIds = Array.from(groupMembers);
    }
    const res = await api.post("/chat/threads/group", payload);
    setLog((l) => [
      ...l.slice(-80),
      `group created: ${res.data.data?.name ?? res.data.data?._id ?? "ok"}`,
    ]);
    setGroupName("");
    setGroupMembers(new Set());
    await loadThreads();
  };

  const socketStatus = socket?.connected
    ? "Online"
    : socket
      ? "Connecting"
      : "Offline";

  const selectedTitle = selectedThread
    ? selectedThread.type === "direct"
      ? selectedThread.directPeer?.fullName ||
        selectedThread.directPeer?.email ||
        "Direct message"
      : selectedThread.name || "Group chat"
    : "";

  return (
    <div className="app-shell">
      <style>{appCss}</style>
      <header className="top-bar">
        <div className="brand">
          <div className="logo-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                fill="#0b1020"
              />
              <path
                d="m9 9 3.5 3.5L9 16m6-7-3.5 3.5L15 16"
                stroke="#e6ecfb"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="brand-title">Golf Messenger</div>
            <div className="brand-subtitle">
              Threads, groups, and realtime updates
            </div>
          </div>
        </div>
        <div className="status-pill">Socket: {socketStatus}</div>
      </header>

      <div className="columns">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel-header">
              <span>Connection</span>
              {viewerRole && <span className="panel-note">{viewerRole}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                className="input"
                placeholder="Paste JWT"
                value={token}
                onChange={(e) => setJwt(e.target.value)}
              />
              <div className="btn-row">
                <button className="btn" onClick={loadFollowing}>
                  Load People
                </button>
                <button className="btn secondary" onClick={loadThreads}>
                  Load Threads
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>{viewerRole === "golf_club" ? "Club Roster" : "Following"}</span>
            </div>
            <div className="list">
              {viewerRole === "golf_club" &&
                clubRoster.map((member) => (
                  <div key={member._id} className="list-item muted">
                    <div className="list-title">
                      {member.fullName || member.email || member._id}
                    </div>
                  </div>
                ))}
              {viewerRole === "golf_club" && !clubRoster.length && (
                <div className="list-item muted">No club members loaded.</div>
              )}
              {viewerRole !== "golf_club" &&
                following.map((f) => (
                  <div
                    key={f.golfer._id}
                    className={`list-item ${
                      selectedPeer?._id === f.golfer._id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedPeer(f.golfer)}
                  >
                    <div className="list-title">
                      {f.golfer.fullName || f.golfer.email || f.golfer._id}
                    </div>
                    <div className="list-subtitle">Tap to start a direct</div>
                  </div>
                ))}
              {viewerRole !== "golf_club" && !following.length && (
                <div className="list-item muted">No following golfers loaded.</div>
              )}
            </div>
            {viewerRole !== "golf_club" && (
              <button
                className="btn secondary"
                disabled={!selectedPeer}
                onClick={async () => {
                  if (!selectedPeer) return;
                  if (!token.trim()) return;
                  setToken(token.trim());
                  try {
                    const res = await api.post("/chat/threads/direct", {
                      golferUserId: selectedPeer._id,
                    });
                    const thread = res.data.data ?? res.data;
                    setLog((l) => [
                      ...l.slice(-80),
                      `direct ready with ${
                        selectedPeer.fullName || selectedPeer._id
                      }`,
                    ]);
                    setSelectedThread(thread);
                    await loadThreads();
                    await loadMessages(thread._id);
                  } catch (err: any) {
                    setLog((l) => [
                      ...l.slice(-80),
                      `direct error: ${err?.message ?? err}`,
                    ]);
                  }
                }}
                style={{ marginTop: 10, width: "100%" }}
              >
                Create or Load Direct
              </button>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Direct Threads</span>
            </div>
            <div className="list">
              {threads
                .filter((t) => t.type === "direct")
                .map((t) => (
                  <div
                    key={t._id}
                    className={`list-item ${
                      selectedThread?._id === t._id ? "selected" : ""
                    }`}
                    onClick={async () => {
                      setSelectedThread(t);
                      await loadMessages(t._id);
                    }}
                  >
                    <div className="list-title">
                      {t.directPeer?.fullName ||
                        t.directPeer?.email ||
                        `DM ${t._id.slice(-6)}`}
                    </div>
                    <div className="list-subtitle">
                      {t.lastMessage?.text || "No messages yet"}
                    </div>
                  </div>
                ))}
              {!threads.some((t) => t.type === "direct") && (
                <div className="list-item muted">
                  No direct threads. Create one then reload.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Group Threads</span>
            </div>
            <div className="list">
              {threads
                .filter((t) => t.type === "group")
                .map((t) => (
                  <div
                    key={t._id}
                    className={`list-item ${
                      selectedThread?._id === t._id ? "selected" : ""
                    }`}
                    onClick={async () => {
                      setSelectedThread(t);
                      await loadMessages(t._id);
                    }}
                  >
                    <div className="list-title">{t.name || `Group ${t._id}`}</div>
                    <div className="list-subtitle">
                      {t.lastMessage?.text || "No messages yet"}
                    </div>
                  </div>
                ))}
              {!threads.some((t) => t.type === "group") && (
                <div className="list-item muted">No groups loaded.</div>
              )}
            </div>
          </section>
        </aside>

        <main className="main">
          <section className="panel chat-panel">
            {selectedThread ? (
              <>
                <div className="chat-header">
                  <div>
                    <div className="chat-title">{selectedTitle}</div>
                    <div className="chat-subtitle">
                      {selectedThread.type === "direct"
                        ? "Direct conversation"
                        : `Group members: ${selectedThread.memberUserIds?.length ?? 0}`}
                    </div>
                  </div>
                  <div className="panel-note">{selectedThread._id}</div>
                </div>

                <div className="chat-scroll">
                  {messages.map((m) => {
                    const isOwn =
                      m.senderUserId === "me" ||
                      (viewerUserId && m.senderUserId === viewerUserId);
                    const displayName = getDisplayName(m.senderUserId);
                    const initials = getInitials(displayName);
                    return (
                      <div
                        key={m._id}
                        className={`message-row ${isOwn ? "me" : ""}`}
                      >
                        {!isOwn && <div className="avatar">{initials}</div>}
                        <div className="message-block">
                          <div
                            className={`message-meta ${isOwn ? "me" : ""}`}
                          >
                            {displayName} - {formatTime(m.createdAt)}
                          </div>
                          <div className={`bubble ${isOwn ? "me" : ""}`}>
                            <div className="message-text">
                              {m.text || "[media]"}
                            </div>
                            {m.imageUrl && (
                              <img
                                className="message-media"
                                src={m.imageUrl}
                                alt="attachment"
                                loading="lazy"
                              />
                            )}
                          </div>
                        </div>
                        {isOwn && <div className="avatar me">{initials}</div>}
                      </div>
                    );
                  })}
                  {messagesError && (
                    <div className="panel-note">Error: {messagesError}</div>
                  )}
                  {!messages.length && !messagesError && (
                    <div className="empty-state">No history yet.</div>
                  )}
                </div>

                <div className="input-row">
                  <textarea
                    className="textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message"
                  />
                  <button className="btn" onClick={sendMessage}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                Select a thread to open the conversation.
              </div>
            )}
          </section>
        </main>

        <aside className="side-right">
          <section className="panel">
            <div className="panel-header">
              <span>Create Group</span>
            </div>
            {viewerRole === "golf_club" && (
              <div className="panel-note" style={{ marginBottom: 10 }}>
                Club groups auto-add all club members.
              </div>
            )}
            <input
              className="input"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            {viewerRole !== "golf_club" && (
              <div className="list checkbox-list" style={{ marginTop: 10 }}>
                {following.map((f) => (
                  <label key={f.golfer._id}>
                    <input
                      type="checkbox"
                      checked={groupMembers.has(f.golfer._id)}
                      onChange={() => toggleMember(f.golfer._id)}
                    />
                    {f.golfer.fullName || f.golfer.email || f.golfer._id}
                  </label>
                ))}
                {!following.length && (
                  <div className="list-item muted">
                    Load following to pick members.
                  </div>
                )}
              </div>
            )}
            <button className="btn" onClick={createGroup} style={{ marginTop: 10 }}>
              Create Group
            </button>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Log</span>
            </div>
            <div className="log-list">
              {log.map((l, i) => (
                <div key={i} className="log-item">
                  {l}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
