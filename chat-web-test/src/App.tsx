import { useEffect, useMemo, useRef, useState } from "react";
import { api, normalizeToken, setToken } from "./api";
import { createSocket } from "./socket";

type UserLite = { _id: string; fullName?: string; email?: string };
type FollowingItem = { golfer: UserLite; isFollowing: boolean };
type Thread = {
  _id: string;
  type: "direct" | "group";
  name?: string | null;
  memberUserIds: string[];
  directPeer?: UserLite | null;
  lastMessage?: { text?: string | null; imageUrl?: string | null } | null;
};
type Reaction = { userId: string; emoji: "love"; reactedAt: string };
type Message = {
  _id: string;
  threadId: string;
  senderUserId: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
  reactions: Reaction[];
  sender?: UserLite | null;
};

const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0e1320;color:#e9eefb}
.wrap{padding:16px;display:grid;gap:12px}
.card{background:#151d30;border:1px solid #2b3656;border-radius:10px;padding:12px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.input,.textarea,button{background:#0f1728;border:1px solid #2b3656;color:#e9eefb;border-radius:8px;padding:8px}
button{cursor:pointer}
.input{width:100%}.textarea{width:100%;min-height:70px}
.grid{display:grid;grid-template-columns:280px 1fr 320px;gap:12px}
.list{max-height:220px;overflow:auto;border:1px solid #2b3656;border-radius:8px}
.item{padding:8px;border-bottom:1px solid #23304c;cursor:pointer}.item:last-child{border-bottom:none}
.item.sel{background:#1d2945}.muted{color:#9badcf;font-size:12px}
.chat{display:grid;gap:10px}
.msgs{max-height:60vh;overflow:auto;border:1px solid #2b3656;border-radius:8px;padding:10px}
.msg{margin-bottom:10px;padding:8px;border:1px solid #2b3656;border-radius:8px;background:#10182a}
.meta{font-size:12px;color:#9badcf}.txt{white-space:pre-wrap}
.rx{display:flex;gap:8px;align-items:center;margin-top:6px}
.rxbtn{padding:4px 8px;font-size:12px}.rxbtn.active{border-color:#48d0a0;color:#48d0a0}
.log{max-height:240px;overflow:auto;font-size:12px}
@media(max-width:1100px){.grid{grid-template-columns:1fr}}
`;

const isRecord = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null;
const toStr = (v: unknown): string | null =>
  typeof v === "string" ? v : v == null ? null : String(v);
const normalizeUser = (v: unknown): UserLite | null => {
  if (!isRecord(v)) return null;
  const id = toStr(v._id ?? v.id);
  if (!id) return null;
  return {
    _id: id,
    fullName: toStr(v.fullName) ?? undefined,
    email: toStr(v.email) ?? undefined,
  };
};
const normalizeReactions = (v: unknown): Reaction[] =>
  Array.isArray(v)
    ? v
        .map((x) => {
          if (!isRecord(x)) return null;
          const userId = toStr(x.userId);
          if (!userId) return null;
          return {
            userId,
            emoji: "love" as const,
            reactedAt: toStr(x.reactedAt) ?? new Date().toISOString(),
          };
        })
        .filter((x): x is Reaction => Boolean(x))
    : [];
const normalizeMessage = (v: unknown, fallbackThreadId?: string): Message | null => {
  if (!isRecord(v)) return null;
  const id = toStr(v._id ?? v.id);
  const threadId = toStr(v.threadId ?? v.convId) ?? fallbackThreadId;
  const senderUserId = toStr(v.senderUserId ?? v.senderId);
  if (!id || !threadId || !senderUserId) return null;
  const mediaArr =
    Array.isArray(v.mediaUrls) && v.mediaUrls.length > 0 && typeof v.mediaUrls[0] === "string"
      ? v.mediaUrls[0]
      : null;
  const imageUrl = toStr(v.imageUrl ?? v.mediaUrl) ?? mediaArr;
  const textRaw = toStr(v.text);
  return {
    _id: id,
    threadId,
    senderUserId,
    text: textRaw && textRaw.trim() ? textRaw : null,
    imageUrl: imageUrl && imageUrl.trim() ? imageUrl : null,
    createdAt: toStr(v.createdAt ?? v.sentAt) ?? new Date().toISOString(),
    reactions: normalizeReactions(v.reactions),
    sender: normalizeUser(v.sender),
  };
};
const unwrap = (res: any): any => res?.data?.data ?? res?.data ?? res;
const fmtTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function App() {
  const [token, setJwt] = useState("");
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState<FollowingItem[]>([]);
  const [clubRoster, setClubRoster] = useState<UserLite[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<UserLite | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const selectedThreadRef = useRef<Thread | null>(null);
  const [joinedThreadId, setJoinedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<string[]>([]);
  const [busyReactionId, setBusyReactionId] = useState<string | null>(null);

  const rawToken = useMemo(() => normalizeToken(token), [token]);
  const socket = useMemo(() => (rawToken ? createSocket(rawToken) : null), [rawToken]);
  const addLog = (line: string) => setLog((prev) => [...prev.slice(-120), line]);

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    if (!rawToken) {
      setViewerRole(null);
      setViewerUserId(null);
      return;
    }
    try {
      const part = rawToken.split(".")[1];
      const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      setViewerRole(typeof payload?.role === "string" ? payload.role : null);
      setViewerUserId(
        (typeof payload?.userId === "string" && payload.userId) ||
          (typeof payload?._id === "string" && payload._id) ||
          null,
      );
    } catch {
      setViewerRole(null);
      setViewerUserId(null);
    }
  }, [rawToken]);

  const ensureJoin = async (threadId: string) => {
    if (!socket) return false;
    if (socket.connected && joinedThreadId === threadId) return true;
    return new Promise<boolean>((resolve) => {
      socket.emit("join", { convId: threadId }, (resp: any) => {
        if (resp?.ok) {
          setJoinedThreadId(threadId);
          addLog(`joined ${threadId}`);
          resolve(true);
          return;
        }
        addLog(`join failed: ${resp?.error ?? "unknown error"}`);
        resolve(false);
      });
    });
  };

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => addLog("socket connected");
    const onConnectError = (err: Error) => addLog(`connect_error: ${err.message}`);
    const onNew = (payload: unknown) => {
      const msg = normalizeMessage(payload);
      if (!msg) return;
      setThreads((prev) => {
        const i = prev.findIndex((x) => x._id === msg.threadId);
        if (i < 0) return prev;
        const updated: Thread = {
          ...prev[i],
          lastMessage: { text: msg.text, imageUrl: msg.imageUrl },
        };
        return [updated, ...prev.filter((_, idx) => idx !== i)];
      });
      setMessages((prev) => {
        const current = selectedThreadRef.current;
        if (!current || current._id !== msg.threadId) return prev;
        const tempId = isRecord(payload) ? toStr(payload.tempId) : null;
        if (tempId) {
          const ti = prev.findIndex((x) => x._id === tempId);
          if (ti >= 0) {
            const next = [...prev];
            next[ti] = { ...next[ti], ...msg };
            return next;
          }
        }
        const i = prev.findIndex((x) => x._id === msg._id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], ...msg };
          return next;
        }
        return [...prev, msg];
      });
    };
    const onReacted = (payload: any) => {
      const messageId = toStr(payload?.messageId);
      const convId = toStr(payload?.convId);
      if (!messageId || !convId) return;
      const reactions = normalizeReactions(payload?.reactions);
      setMessages((prev) => {
        const current = selectedThreadRef.current;
        if (!current || current._id !== convId) return prev;
        return prev.map((m) => (m._id === messageId ? { ...m, reactions } : m));
      });
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("new-msg", onNew);
    socket.on("msg-reacted", onReacted);
    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("new-msg", onNew);
      socket.off("msg-reacted", onReacted);
      socket.disconnect();
    };
  }, [socket]);

  const loadPeople = async () => {
    if (!token.trim()) return;
    setToken(token.trim());
    try {
      if (viewerRole === "golf_club") {
        const res = await api.get("/golf-clubs/me/roles");
        const payload = unwrap(res);
        const managers = Array.isArray(payload?.managers) ? payload.managers : [];
        const members = Array.isArray(payload?.members) ? payload.members : [];
        const roster = [...managers, ...members]
          .map((x) => normalizeUser(x?.user))
          .filter((x): x is UserLite => Boolean(x));
        setClubRoster(roster);
        setFollowing([]);
        addLog(`loaded ${roster.length} club members`);
        return;
      }
      const res = await api.get("/social-feed/golfers/following", {
        params: { page: 1, limit: 50 },
      });
      const list = Array.isArray(unwrap(res)) ? unwrap(res) : [];
      setFollowing(list as FollowingItem[]);
      setClubRoster([]);
      addLog(`loaded ${list.length} following`);
    } catch (e) {
      addLog(`load people failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadThreads = async () => {
    if (!token.trim()) return;
    setToken(token.trim());
    try {
      const res = await api.get("/chat/threads");
      const list = Array.isArray(unwrap(res)) ? unwrap(res) : [];
      setThreads(list as Thread[]);
      addLog(`loaded ${list.length} threads`);
    } catch (e) {
      addLog(`load threads failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadMessages = async (threadId: string) => {
    if (!token.trim()) return;
    setToken(token.trim());
    try {
      const res = await api.get(`/chat/threads/${threadId}/messages`);
      const payload = unwrap(res);
      const raw = Array.isArray(payload) ? payload : Array.isArray(payload?.messages) ? payload.messages : [];
      const mapped = raw
        .map((x: unknown) => normalizeMessage(x, threadId))
        .filter((x: Message | null): x is Message => Boolean(x));
      setMessages(mapped);
      addLog(`loaded ${mapped.length} messages`);
    } catch (e) {
      addLog(`load messages failed: ${e instanceof Error ? e.message : String(e)}`);
      setMessages([]);
    }
  };

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    await loadMessages(thread._id);
    if (socket) await ensureJoin(thread._id);
  };

  const createDirect = async () => {
    if (!selectedPeer || !token.trim()) return;
    setToken(token.trim());
    try {
      const res = await api.post("/chat/threads/direct", { golferUserId: selectedPeer._id });
      const thread = unwrap(res) as Thread;
      if (!thread?._id) return;
      addLog(`direct ready with ${selectedPeer.fullName || selectedPeer._id}`);
      await loadThreads();
      await openThread(thread);
    } catch (e) {
      addLog(`direct failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const sendMessage = async () => {
    if (!selectedThread || !socket) return;
    const t = text.trim();
    const m = mediaUrl.trim();
    if (!t && !m) return;
    if (!(await ensureJoin(selectedThread._id))) return;
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        _id: tempId,
        threadId: selectedThread._id,
        senderUserId: viewerUserId ?? "me",
        text: t || null,
        imageUrl: m || null,
        createdAt: new Date().toISOString(),
        reactions: [],
      },
    ]);
    setText("");
    setMediaUrl("");
    socket.emit(
      "send-msg",
      { convId: selectedThread._id, text: t || undefined, mediaUrl: m || undefined, tempId },
      (resp: any) => {
        if (!resp?.ok) {
          setMessages((prev) => prev.filter((x) => x._id !== tempId));
          addLog(`send failed: ${resp?.error ?? "unknown error"}`);
          return;
        }
        const mapped = normalizeMessage(resp?.message, selectedThread._id);
        if (mapped) {
          setMessages((prev) => prev.map((x) => (x._id === tempId ? { ...x, ...mapped } : x)));
        }
      },
    );
  };

  const reactToMessage = async (messageId: string) => {
    if (!selectedThread || !token.trim()) return;
    setToken(token.trim());
    setBusyReactionId(messageId);
    try {
      if (socket && (await ensureJoin(selectedThread._id))) {
        const ok = await new Promise<boolean>((resolve) => {
          socket.emit("react-msg", { messageId }, (resp: any) => {
            if (!resp?.ok) {
              resolve(false);
              return;
            }
            const reactions = normalizeReactions(resp?.data?.reactions);
            setMessages((prev) =>
              prev.map((x) => (x._id === messageId ? { ...x, reactions } : x)),
            );
            resolve(true);
          });
        });
        if (ok) return;
      }
      const res = await api.patch(`/chat/messages/${messageId}/reaction`, {});
      const updated = normalizeMessage(unwrap(res)?.message, selectedThread._id);
      if (updated) {
        setMessages((prev) =>
          prev.map((x) => (x._id === messageId ? { ...x, reactions: updated.reactions } : x)),
        );
      }
    } catch (e) {
      addLog(`react failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyReactionId(null);
    }
  };

  const createGroup = async () => {
    if (!token.trim() || !groupName.trim()) return;
    setToken(token.trim());
    const payload: any = { name: groupName.trim() };
    if (viewerRole !== "golf_club") payload.memberUserIds = Array.from(groupMembers);
    try {
      await api.post("/chat/threads/group", payload);
      setGroupName("");
      setGroupMembers(new Set());
      await loadThreads();
      addLog("group created");
    } catch (e) {
      addLog(`group create failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const usersById = useMemo(() => {
    const map = new Map<string, UserLite>();
    following.forEach((x) => map.set(x.golfer._id, x.golfer));
    clubRoster.forEach((x) => map.set(x._id, x));
    threads.forEach((x) => x.directPeer?._id && map.set(x.directPeer._id, x.directPeer));
    messages.forEach((x) => x.sender?._id && map.set(x.sender._id, x.sender));
    return map;
  }, [following, clubRoster, threads, messages]);
  const display = (id: string) =>
    id === viewerUserId ? "You" : usersById.get(id)?.fullName || usersById.get(id)?.email || id.slice(-6);
  const threadTitle = selectedThread
    ? selectedThread.type === "direct"
      ? selectedThread.directPeer?.fullName || selectedThread.directPeer?.email || "Direct"
      : selectedThread.name || "Group"
    : "No thread selected";

  return (
    <div className="wrap">
      <style>{css}</style>
      <div className="card row">
        <input className="input" placeholder="Paste JWT" value={token} onChange={(e) => setJwt(e.target.value)} />
        <button onClick={loadPeople}>Load People</button>
        <button onClick={loadThreads}>Load Threads</button>
        <span className="muted">role: {viewerRole || "-"}</span>
        <span className="muted">socket: {socket?.connected ? "online" : socket ? "connecting" : "offline"}</span>
      </div>

      <div className="grid">
        <div className="card">
          <div className="row"><strong>{viewerRole === "golf_club" ? "Club Roster" : "Following"}</strong></div>
          <div className="list">
            {viewerRole === "golf_club" &&
              clubRoster.map((u) => <div className="item" key={u._id}>{u.fullName || u.email || u._id}</div>)}
            {viewerRole !== "golf_club" &&
              following.map((f) => (
                <div
                  className={`item ${selectedPeer?._id === f.golfer._id ? "sel" : ""}`}
                  key={f.golfer._id}
                  onClick={() => setSelectedPeer(f.golfer)}
                >
                  {f.golfer.fullName || f.golfer.email || f.golfer._id}
                </div>
              ))}
          </div>
          {viewerRole !== "golf_club" && (
            <div className="row" style={{ marginTop: 8 }}>
              <button disabled={!selectedPeer} onClick={createDirect}>Create/Load Direct</button>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <strong>Threads</strong>
            <div className="list" style={{ marginTop: 6 }}>
              {threads.map((t) => (
                <div
                  key={t._id}
                  className={`item ${selectedThread?._id === t._id ? "sel" : ""}`}
                  onClick={() => void openThread(t)}
                >
                  <div>{t.type === "direct" ? t.directPeer?.fullName || t.directPeer?.email || "Direct" : t.name || "Group"}</div>
                  <div className="muted">{t.lastMessage?.text || (t.lastMessage?.imageUrl ? "[image]" : "No messages")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card chat">
          <div className="row">
            <strong>{threadTitle}</strong>
            {selectedThread && <button onClick={() => void loadMessages(selectedThread._id)}>Reload</button>}
          </div>
          <div className="msgs">
            {messages.map((m) => {
              const mine = viewerUserId && m.senderUserId === viewerUserId;
              const loved = Boolean(viewerUserId && m.reactions.some((r) => r.userId === viewerUserId));
              return (
                <div className="msg" key={m._id}>
                  <div className="meta">{display(m.senderUserId)} - {fmtTime(m.createdAt)}</div>
                  <div className="txt">{m.text || (m.imageUrl ? "[image]" : "")}</div>
                  {m.imageUrl && <img src={m.imageUrl} alt="attachment" style={{ maxWidth: 220, borderRadius: 8, marginTop: 6 }} />}
                  <div className="rx">
                    <button
                      className={`rxbtn ${loved ? "active" : ""}`}
                      disabled={busyReactionId === m._id || m._id.startsWith("tmp-")}
                      onClick={() => void reactToMessage(m._id)}
                    >
                      {loved ? "Loved" : "Love"}
                    </button>
                    <span className="muted">love x{m.reactions.length}</span>
                    {mine && <span className="muted">(you)</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedThread && (
            <>
              <textarea className="textarea" placeholder="Type message" value={text} onChange={(e) => setText(e.target.value)} />
              <input className="input" placeholder="Optional image URL" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
              <div className="row">
                <button onClick={sendMessage}>Send</button>
                <button onClick={() => { setText(""); setMediaUrl(""); }}>Clear</button>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <strong>Create Group</strong>
          <input className="input" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ marginTop: 8 }} />
          {viewerRole !== "golf_club" && (
            <div className="list" style={{ marginTop: 8 }}>
              {following.map((f) => (
                <label key={f.golfer._id} className="item" style={{ display: "flex", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={groupMembers.has(f.golfer._id)}
                    onChange={() =>
                      setGroupMembers((prev) => {
                        const next = new Set(prev);
                        next.has(f.golfer._id) ? next.delete(f.golfer._id) : next.add(f.golfer._id);
                        return next;
                      })
                    }
                  />
                  {f.golfer.fullName || f.golfer.email || f.golfer._id}
                </label>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={createGroup}>Create Group</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>Log</strong>
            <div className="log">
              {log.map((line, i) => (
                <div key={`${i}-${line}`} className="muted">{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
