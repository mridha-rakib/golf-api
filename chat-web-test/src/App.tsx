import { useEffect, useMemo, useRef, useState } from "react";
import { api, normalizeToken, setToken } from "./api";
import { createSocket } from "./socket";

type ThreadType = "direct" | "group";
type UserLite = { _id: string; fullName?: string; email?: string };
type Thread = {
  _id: string;
  type: ThreadType;
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
type Snapshot = { source: string; ok: boolean; time: string; data: unknown };

const css = `
*{box-sizing:border-box}html,body,#root{min-height:100%}
body{margin:0;font-family:"Space Grotesk","Segoe UI",sans-serif;background:#091324;color:#ecf3ff}
.app{max-width:1500px;margin:0 auto;padding:14px;display:grid;gap:10px}
.card{background:#101d34;border:1px solid #2d456c;border-radius:12px;padding:10px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.input,.select,.area,.btn{background:#0b1528;border:1px solid #2a446c;color:#eaf1ff;border-radius:8px;font:inherit}
.input,.select,.area{padding:8px;width:100%}.area{min-height:82px;resize:vertical}.btn{padding:8px 10px;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}
.badge{font-size:12px;color:#a8c2eb;border:1px solid #315485;padding:2px 8px;border-radius:999px}
.badge.ok{border-color:#2f8a74;color:#91e5cd}.badge.err{border-color:#9c4d5a;color:#ffbdc7}
.grid{display:grid;grid-template-columns:300px 1fr 360px;gap:10px}
.list{max-height:260px;overflow:auto;border:1px solid #294365;border-radius:8px;margin-top:8px}
.item{padding:8px;border-bottom:1px solid #223853;cursor:pointer}.item:last-child{border-bottom:0}.item.sel{background:#183056}
.muted{font-size:12px;color:#9bb1d7}
.msgs{max-height:56vh;overflow:auto;border:1px solid #294365;border-radius:8px;padding:8px;background:#0d1a30}
.msg{border:1px solid #2c4468;border-radius:8px;background:#12223d;padding:8px;margin-bottom:8px}.msg:last-child{margin-bottom:0}
.pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;font-size:12px}
.panel{max-height:320px;overflow:auto;border:1px solid #294365;border-radius:8px;padding:8px;background:#0a1528}
@media(max-width:1200px){.grid{grid-template-columns:1fr}.msgs{max-height:42vh}}
`;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
const arrStr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => str(x)?.trim()).filter((x): x is string => Boolean(x))
    : [];

const normUser = (v: unknown): UserLite | null => {
  if (!isObj(v)) return null;
  const id = str(v._id ?? v.id)?.trim();
  if (!id) return null;
  return {
    _id: id,
    fullName: str(v.fullName ?? v.name ?? v.displayName) ?? undefined,
    email: str(v.email) ?? undefined,
  };
};

const normRx = (v: unknown): Reaction[] =>
  Array.isArray(v)
    ? v
        .map((x) => {
          if (!isObj(x)) return null;
          const userId = str(x.userId)?.trim();
          if (!userId) return null;
          return {
            userId,
            emoji: "love" as const,
            reactedAt: str(x.reactedAt) ?? new Date().toISOString(),
          };
        })
        .filter((x): x is Reaction => Boolean(x))
    : [];

const normMsg = (v: unknown, fallbackThread?: string): Message | null => {
  if (!isObj(v)) return null;
  const id = str(v._id ?? v.id)?.trim();
  const threadId = str(v.threadId ?? v.convId)?.trim() ?? fallbackThread;
  const senderUserId = str(v.senderUserId ?? v.senderId)?.trim();
  if (!id || !threadId || !senderUserId) return null;
  const m0 = Array.isArray(v.mediaUrls) && typeof v.mediaUrls[0] === "string" ? v.mediaUrls[0] : null;
  const imageUrl = str(v.imageUrl ?? v.mediaUrl)?.trim() || (m0 && m0.trim() ? m0 : null);
  const t = str(v.text);
  return {
    _id: id,
    threadId,
    senderUserId,
    text: t && t.trim() ? t : null,
    imageUrl,
    createdAt: str(v.createdAt ?? v.sentAt) ?? new Date().toISOString(),
    reactions: normRx(v.reactions),
    sender: normUser(v.sender),
  };
};

const normThread = (v: unknown): Thread | null => {
  if (!isObj(v)) return null;
  const id = str(v._id ?? v.id)?.trim();
  const type = str(v.type)?.trim();
  if (!id || (type !== "direct" && type !== "group")) return null;
  const lm = isObj(v.lastMessage)
    ? { text: str(v.lastMessage.text), imageUrl: str(v.lastMessage.imageUrl) }
    : null;
  return {
    _id: id,
    type,
    name: str(v.name),
    memberUserIds: arrStr(v.memberUserIds),
    directPeer: normUser(v.directPeer),
    lastMessage: lm,
  };
};

const dedupeUsers = (users: UserLite[]): UserLite[] => {
  const map = new Map<string, UserLite>();
  users.forEach((u) => {
    const prev = map.get(u._id);
    map.set(u._id, {
      _id: u._id,
      fullName: u.fullName ?? prev?.fullName,
      email: u.email ?? prev?.email,
    });
  });
  return Array.from(map.values());
};

const unwrap = (r: unknown): unknown => {
  if (!isObj(r)) return r;
  const d1 = r.data;
  if (!isObj(d1)) return d1 ?? r;
  return d1.data ?? d1;
};
const errData = (e: unknown): unknown => {
  if (isObj(e) && isObj(e.response) && "data" in e.response) {
    return e.response.data;
  }
  if (isObj(e) && typeof e.message === "string") {
    return { message: e.message };
  }
  return { message: String(e) };
};
const errMsg = (e: unknown): string => {
  if (
    isObj(e) &&
    isObj(e.response) &&
    isObj(e.response.data) &&
    typeof e.response.data.message === "string"
  ) {
    return e.response.data.message;
  }
  if (isObj(e) && typeof e.message === "string") return e.message;
  return String(e);
};
const fmt = (v: string): string => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const decodeJwt = (token: string): Record<string, unknown> | null => {
  try {
    const p = token.split(".")[1] || "";
    if (!p) return null;
    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b + "===".slice((b.length + 3) % 4);
    const j = JSON.parse(atob(pad));
    return isObj(j) ? j : null;
  } catch {
    return null;
  }
};

export default function App() {
  const [jwtDraft, setJwtDraft] = useState("");
  const [jwt, setJwtRaw] = useState("");
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");

  const [people, setPeople] = useState<UserLite[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadType, setThreadType] = useState<"all" | ThreadType>("all");
  const [clubFilterId, setClubFilterId] = useState("");

  const [peerId, setPeerId] = useState("");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const selectedThreadRef = useRef<Thread | null>(null);
  const [joinedThread, setJoinedThread] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [busyReactionId, setBusyReactionId] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupClubId, setGroupClubId] = useState("");
  const [groupAvatarUrl, setGroupAvatarUrl] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const token = useMemo(() => normalizeToken(jwt), [jwt]);
  const socket = useMemo(() => (token ? createSocket(token) : null), [token]);

  const socketStatus = socket ? (socket.connected ? "online" : "connecting") : "offline";

  const addLog = (line: string) => {
    setLogs((prev) => [...prev.slice(-139), `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const saveSnap = (source: string, ok: boolean, data: unknown) => {
    setSnap({ source, ok, time: new Date().toISOString(), data });
  };

  const callApi = async <T,>(source: string, fn: () => Promise<unknown>): Promise<T | null> => {
    try {
      const res = await fn();
      const data = unwrap(res) as T;
      saveSnap(source, true, data);
      return data;
    } catch (e) {
      saveSnap(source, false, errData(e));
      addLog(`${source} failed: ${errMsg(e)}`);
      return null;
    }
  };

  const ensureToken = (): boolean => {
    if (!token) {
      addLog("Apply JWT first.");
      return false;
    }
    setToken(token);
    return true;
  };

  const ensureJoin = async (threadId: string): Promise<boolean> => {
    if (!socket) {
      addLog("Socket is not ready.");
      return false;
    }
    if (socket.connected && joinedThread === threadId) return true;

    return new Promise<boolean>((resolve) => {
      socket.emit("join", { convId: threadId }, (resp: unknown) => {
        const ok = isObj(resp) && Boolean(resp.ok);
        saveSnap("socket:join", ok, resp);
        if (ok) {
          setJoinedThread(threadId);
          addLog(`Joined thread ${threadId}`);
          resolve(true);
          return;
        }
        addLog(
          `Join failed: ${isObj(resp) ? str(resp.error) ?? "Unknown error" : "Unknown error"}`,
        );
        resolve(false);
      });
    });
  };

  const applyJwt = () => {
    const v = normalizeToken(jwtDraft);
    setJwtRaw(v);
    setToken(v);
    setJoinedThread("");
    addLog(v ? "JWT applied." : "JWT cleared.");
  };

  const resetAll = () => {
    setJwtDraft("");
    setJwtRaw("");
    setToken("");
    setRole("");
    setUserId("");
    setPeople([]);
    setThreads([]);
    setPeerId("");
    setSelectedThread(null);
    setJoinedThread("");
    setMessages([]);
    addLog("Session reset.");
  };

  const loadPeople = async () => {
    if (!ensureToken()) return;

    if (role === "golf_club") {
      const data = await callApi<unknown>("GET /golf-clubs/me/roles", () => api.get("/golf-clubs/me/roles"));
      if (!data) return;
      const managers = isObj(data) && Array.isArray(data.managers) ? data.managers : [];
      const members = isObj(data) && Array.isArray(data.members) ? data.members : [];
      const users = dedupeUsers(
        [...managers, ...members]
          .map((x) => normUser(isObj(x) ? x.user ?? x.golfer ?? x : x))
          .filter((x): x is UserLite => Boolean(x)),
      );
      setPeople(users);
      setPeerId("");
      addLog(`Loaded ${users.length} users (club).`);
      return;
    }

    const data = await callApi<unknown>("GET /social-feed/golfers/following", () =>
      api.get("/social-feed/golfers/following", { params: { page: 1, limit: 100 } }),
    );
    if (!data) return;
    const list = Array.isArray(data) ? data : [];
    const users = dedupeUsers(
      list
        .map((x) => normUser(isObj(x) ? x.golfer ?? x.user ?? x : x))
        .filter((x): x is UserLite => Boolean(x)),
    );
    setPeople(users);
    setPeerId((prev) => prev || users[0]?._id || "");
    addLog(`Loaded ${users.length} users (following).`);
  };

  const loadThreads = async () => {
    if (!ensureToken()) return;
    const params = threadType === "all" ? undefined : { type: threadType };
    const data = await callApi<unknown[]>("GET /chat/threads", () => api.get("/chat/threads", { params }));
    if (!data) return;
    const rows = (Array.isArray(data) ? data : [])
      .map((x) => normThread(x))
      .filter((x): x is Thread => Boolean(x));
    setThreads(rows);
    addLog(`Loaded ${rows.length} threads.`);
  };

  const loadThreadsByClub = async () => {
    if (!ensureToken()) return;
    const clubId = clubFilterId.trim();
    if (!clubId) {
      addLog("Club ID is required.");
      return;
    }
    const data = await callApi<unknown[]>(`GET /chat/threads/club/${clubId}`, () => api.get(`/chat/threads/club/${clubId}`));
    if (!data) return;
    const rows = (Array.isArray(data) ? data : [])
      .map((x) => normThread(x))
      .filter((x): x is Thread => Boolean(x));
    setThreads(rows);
    addLog(`Loaded ${rows.length} club threads.`);
  };

  const loadMessages = async (threadId: string) => {
    if (!ensureToken()) return;
    const data = await callApi<unknown>(`GET /chat/threads/${threadId}/messages`, () =>
      api.get(`/chat/threads/${threadId}/messages`),
    );
    if (!data) {
      setMessages([]);
      return;
    }
    const raw =
      Array.isArray(data)
        ? data
        : isObj(data) && Array.isArray(data.messages)
          ? data.messages
          : [];
    const rows = raw
      .map((x: unknown) => normMsg(x, threadId))
      .filter((x: Message | null): x is Message => Boolean(x));
    setMessages(rows);
    addLog(`Loaded ${rows.length} messages.`);
  };

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    await loadMessages(thread._id);
    if (socket) await ensureJoin(thread._id);
  };

  const createDirect = async () => {
    if (!ensureToken()) return;
    if (role !== "golfer") {
      addLog("Direct thread route is golfer-only.");
      return;
    }
    if (!peerId) {
      addLog("Select a golfer first.");
      return;
    }
    const data = await callApi<unknown>("POST /chat/threads/direct", () =>
      api.post("/chat/threads/direct", { golferUserId: peerId }),
    );
    if (!data) return;
    const thread = normThread(data);
    if (!thread) {
      addLog("Unexpected direct-thread response.");
      return;
    }
    await loadThreads();
    await openThread(thread);
  };

  const createGroup = async () => {
    if (!ensureToken()) return;
    const name = groupName.trim();
    if (!name) {
      addLog("Group name is required.");
      return;
    }
    if (role !== "golf_club" && !groupClubId.trim()) {
      addLog("For golfer accounts, clubId is required by backend rules.");
      return;
    }
    const body: Record<string, unknown> = { name, memberUserIds: Array.from(groupMembers) };
    if (groupClubId.trim()) body.clubId = groupClubId.trim();
    if (groupAvatarUrl.trim()) body.avatarUrl = groupAvatarUrl.trim();

    const data = await callApi<unknown>("POST /chat/threads/group", () => api.post("/chat/threads/group", body));
    if (!data) return;

    const thread = normThread(data);
    setGroupName("");
    setGroupAvatarUrl("");
    setGroupMembers(new Set());
    await loadThreads();
    if (thread) await openThread(thread);
  };

  const sendMessage = async () => {
    if (!selectedThread) {
      addLog("Select a thread first.");
      return;
    }
    if (!socket) {
      addLog("Socket is unavailable.");
      return;
    }
    const t = text.trim();
    const m = imageUrl.trim();
    if (!t && !m) return;

    const joined = await ensureJoin(selectedThread._id);
    if (!joined) return;

    const tempId = `tmp-${Date.now()}`;
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        _id: tempId,
        threadId: selectedThread._id,
        senderUserId: userId || "me",
        text: t || null,
        imageUrl: m || null,
        createdAt: new Date().toISOString(),
        reactions: [],
      },
    ]);
    setText("");
    setImageUrl("");

    socket.emit(
      "send-msg",
      { convId: selectedThread._id, text: t || undefined, mediaUrl: m || undefined, tempId },
      (resp: unknown) => {
        const ok = isObj(resp) && Boolean(resp.ok);
        saveSnap("socket:send-msg", ok, resp);
        if (!ok) {
          setMessages((prev) => prev.filter((x) => x._id !== tempId));
          addLog(
            `Send failed: ${isObj(resp) ? str(resp.error) ?? "Unknown error" : "Unknown error"}`,
          );
          setSending(false);
          return;
        }
        const mapped = normMsg(isObj(resp) ? resp.message : null, selectedThread._id);
        if (mapped) {
          setMessages((prev) => prev.map((x) => (x._id === tempId ? { ...x, ...mapped } : x)));
          setThreads((prev) =>
            prev.map((th) =>
              th._id === selectedThread._id
                ? { ...th, lastMessage: { text: mapped.text, imageUrl: mapped.imageUrl } }
                : th,
            ),
          );
        }
        setSending(false);
      },
    );
  };

  const reactToMessage = async (messageId: string) => {
    if (!selectedThread || !ensureToken()) return;
    setBusyReactionId(messageId);

    try {
      if (socket && (await ensureJoin(selectedThread._id))) {
        const ok = await new Promise<boolean>((resolve) => {
          socket.emit("react-msg", { messageId }, (resp: unknown) => {
            const success = isObj(resp) && Boolean(resp.ok);
            saveSnap("socket:react-msg", success, resp);
            if (!success) {
              resolve(false);
              return;
            }
            const reactions = normRx(
              isObj(resp) && isObj(resp.data) ? resp.data.reactions : null,
            );
            setMessages((prev) => prev.map((x) => (x._id === messageId ? { ...x, reactions } : x)));
            resolve(true);
          });
        });
        if (ok) return;
      }

      const data = await callApi<unknown>(`PATCH /chat/messages/${messageId}/reaction`, () =>
        api.patch(`/chat/messages/${messageId}/reaction`, {}),
      );
      if (!data) return;
      const updated = normMsg(isObj(data) ? data.message : null, selectedThread._id);
      if (updated) {
        setMessages((prev) =>
          prev.map((x) => (x._id === messageId ? { ...x, reactions: updated.reactions } : x)),
        );
      }
    } finally {
      setBusyReactionId("");
    }
  };

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    if (!token) {
      setRole("");
      setUserId("");
      return;
    }
    const payload = decodeJwt(token);
    if (!payload) {
      setRole("");
      setUserId("");
      return;
    }
    setRole(typeof payload.role === "string" ? payload.role : "");
    setUserId(
      (typeof payload.userId === "string" && payload.userId) ||
        (typeof payload._id === "string" && payload._id) ||
        "",
    );
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      addLog("Socket connected.");
      saveSnap("socket:connect", true, { connected: true, id: socket.id });
    };
    const onDisconnect = (reason: string) => {
      addLog(`Socket disconnected: ${reason}`);
      saveSnap("socket:disconnect", false, { reason });
      setJoinedThread("");
    };
    const onConnectError = (e: Error) => {
      addLog(`Socket connect error: ${e.message}`);
      saveSnap("socket:connect_error", false, { message: e.message });
    };
    const onNew = (payload: unknown) => {
      const mapped = normMsg(payload);
      if (!mapped) return;
      saveSnap("socket:new-msg", true, payload);
      setThreads((prev) => {
        const idx = prev.findIndex((th) => th._id === mapped.threadId);
        if (idx < 0) return prev;
        const updated = { ...prev[idx], lastMessage: { text: mapped.text, imageUrl: mapped.imageUrl } };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
      setMessages((prev) => {
        const current = selectedThreadRef.current;
        if (!current || current._id !== mapped.threadId) return prev;
        const tempId = isObj(payload) ? str(payload.tempId) : null;
        if (tempId) {
          const ti = prev.findIndex((x) => x._id === tempId);
          if (ti >= 0) {
            const next = [...prev];
            next[ti] = { ...next[ti], ...mapped };
            return next;
          }
        }
        return prev.some((x) => x._id === mapped._id)
          ? prev.map((x) => (x._id === mapped._id ? { ...x, ...mapped } : x))
          : [...prev, mapped];
      });
    };
    const onReacted = (payload: unknown) => {
      if (!isObj(payload)) return;
      const messageId = str(payload.messageId)?.trim();
      const convId = str(payload.convId)?.trim();
      if (!messageId || !convId) return;
      saveSnap("socket:msg-reacted", true, payload);
      const reactions = normRx(payload.reactions);
      setMessages((prev) => {
        const current = selectedThreadRef.current;
        if (!current || current._id !== convId) return prev;
        return prev.map((x) => (x._id === messageId ? { ...x, reactions } : x));
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("new-msg", onNew);
    socket.on("msg-reacted", onReacted);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("new-msg", onNew);
      socket.off("msg-reacted", onReacted);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const displayUser = (id: string) => {
    if (userId && id === userId) return "You";
    const inPeople = people.find((u) => u._id === id);
    const inThreads = threads.find((t) => t.directPeer?._id === id)?.directPeer;
    const inMsgs = messages.find((m) => m.sender?._id === id)?.sender;
    const u = inPeople ?? inThreads ?? inMsgs;
    return u?.fullName || u?.email || id.slice(-6);
  };

  const title = selectedThread
    ? selectedThread.type === "group"
      ? selectedThread.name || "Group"
      : selectedThread.directPeer?.fullName || selectedThread.directPeer?.email || "Direct"
    : "No thread selected";

  return (
    <div className="app">
      <style>{css}</style>

      <div className="card">
        <div className="row">
          <input className="input" placeholder="Paste JWT" value={jwtDraft} onChange={(e) => setJwtDraft(e.target.value)} />
          <button className="btn" onClick={applyJwt}>Apply JWT</button>
          <button className="btn" onClick={resetAll}>Reset</button>
          <button className="btn" disabled={!token} onClick={loadPeople}>Load People</button>
          <button className="btn" disabled={!token} onClick={loadThreads}>Load Threads</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="badge">role: {role || "-"}</span>
          <span className="badge">user: {userId || "-"}</span>
          <span className={`badge ${socketStatus === "online" ? "ok" : socketStatus === "offline" ? "err" : ""}`}>socket: {socketStatus}</span>
          <label className="muted" htmlFor="typeFilter">thread type</label>
          <select id="typeFilter" className="select" style={{ maxWidth: 180 }} value={threadType} onChange={(e) => setThreadType(e.target.value as "all" | ThreadType)}>
            <option value="all">all</option><option value="direct">direct</option><option value="group">group</option>
          </select>
          <input className="input" style={{ maxWidth: 250 }} placeholder="Club ID for /chat/threads/club/:clubId" value={clubFilterId} onChange={(e) => setClubFilterId(e.target.value)} />
          <button className="btn" disabled={!token} onClick={loadThreadsByClub}>Load Club Threads</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="muted">{role === "golf_club" ? "Club Roster" : "Following"}</div>
          <div className="list">
            {people.map((u) => (
              <div key={u._id} className={`item ${peerId === u._id ? "sel" : ""}`} onClick={() => setPeerId(u._id)}>
                <div>{u.fullName || u.email || u._id}</div>
                <div className="muted">{u._id}</div>
              </div>
            ))}
            {people.length === 0 && <div className="item muted">No users loaded.</div>}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={createDirect} disabled={!peerId || role !== "golfer"}>Create/Load Direct</button>
          </div>

          <div className="muted" style={{ marginTop: 10 }}>Threads</div>
          <div className="list">
            {threads.map((t) => (
              <div key={t._id} className={`item ${selectedThread?._id === t._id ? "sel" : ""}`} onClick={() => void openThread(t)}>
                <div>{t.type === "group" ? t.name || "Group" : t.directPeer?.fullName || t.directPeer?.email || "Direct"}</div>
                <div className="muted">{t.lastMessage?.text || (t.lastMessage?.imageUrl ? "[image]" : "No messages")}</div>
                <div className="muted">{t._id}</div>
              </div>
            ))}
            {threads.length === 0 && <div className="item muted">No threads loaded.</div>}
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{title}</strong>
            {selectedThread && <button className="btn" onClick={() => void loadMessages(selectedThread._id)}>Reload Messages</button>}
          </div>
          <div className="msgs">
            {messages.map((m) => {
              const mine = Boolean(userId && m.senderUserId === userId);
              const loved = Boolean(userId && m.reactions.some((r) => r.userId === userId));
              return (
                <div className="msg" key={m._id}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">{displayUser(m.senderUserId)}{mine ? " (you)" : ""}</span>
                    <span className="muted">{fmt(m.createdAt)}</span>
                  </div>
                  <div>{m.text || (m.imageUrl ? "[image]" : "")}</div>
                  {m.imageUrl && <img src={m.imageUrl} alt="attachment" style={{ maxWidth: 240, marginTop: 6, borderRadius: 8, border: "1px solid #2a446c" }} />}
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn" disabled={busyReactionId === m._id || m._id.startsWith("tmp-")} onClick={() => void reactToMessage(m._id)}>{loved ? "Loved" : "Love"}</button>
                    <span className="badge">love x{m.reactions.length}</span>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <div className="muted">No messages for this thread yet.</div>}
            <div ref={bottomRef} />
          </div>

          {selectedThread && (
            <>
              <textarea className="area" style={{ marginTop: 8 }} placeholder="Message text" value={text} onChange={(e) => setText(e.target.value)} />
              <input className="input" style={{ marginTop: 8 }} placeholder="Optional image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" disabled={sending} onClick={() => void sendMessage()}>{sending ? "Sending..." : "Send (Socket)"}</button>
                <button className="btn" onClick={() => { setText(""); setImageUrl(""); }}>Clear</button>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="muted">Create Group ({role || "unknown"})</div>
          <input className="input" style={{ marginTop: 8 }} placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <input className="input" style={{ marginTop: 8 }} placeholder={role === "golf_club" ? "Club ID (optional)" : "Club ID (required for golfer)"} value={groupClubId} onChange={(e) => setGroupClubId(e.target.value)} />
          <input className="input" style={{ marginTop: 8 }} placeholder="Avatar URL (optional)" value={groupAvatarUrl} onChange={(e) => setGroupAvatarUrl(e.target.value)} />

          <div className="list" style={{ maxHeight: 190 }}>
            {people.map((u) => (
              <label key={u._id} className="item" style={{ display: "flex", gap: 8 }}>
                <input type="checkbox" checked={groupMembers.has(u._id)} onChange={() => setGroupMembers((prev) => {
                  const next = new Set(prev);
                  if (next.has(u._id)) {
                    next.delete(u._id);
                  } else {
                    next.add(u._id);
                  }
                  return next;
                })} />
                <span>{u.fullName || u.email || u._id}</span>
              </label>
            ))}
            {people.length === 0 && <div className="item muted">Load users to pick members.</div>}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!token} onClick={createGroup}>Create Group</button>
          </div>

          <div className="muted" style={{ marginTop: 12 }}>Backend Response</div>
          <div className="panel">
            {snap ? (
              <>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className={`badge ${snap.ok ? "ok" : "err"}`}>{snap.ok ? "SUCCESS" : "ERROR"}</span>
                  <span className="muted">{snap.source}</span>
                  <span className="muted">{new Date(snap.time).toLocaleString()}</span>
                </div>
                <pre className="pre">{JSON.stringify(snap.data, null, 2)}</pre>
              </>
            ) : (
              <div className="muted">No backend response yet.</div>
            )}
          </div>

          <div className="muted" style={{ marginTop: 12 }}>Activity Log</div>
          <div className="panel" style={{ maxHeight: 220 }}>
            {logs.length > 0 ? logs.map((line, i) => <div key={`${i}-${line}`} className="muted" style={{ marginBottom: 3 }}>{line}</div>) : <div className="muted">No logs yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
