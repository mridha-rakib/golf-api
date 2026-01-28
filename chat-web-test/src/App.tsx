import { useEffect, useMemo, useState } from "react";
import { api, setToken } from "./api";
import { createSocket } from "./socket";

type Golfer = { _id: string; fullName?: string; email?: string };
type FollowingItem = { golfer: Golfer; isFollowing: boolean };
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

export default function App() {
  const [token, setJwt] = useState("");
  const [following, setFollowing] = useState<FollowingItem[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Golfer | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const socket = useMemo(() => (token ? createSocket(token) : null), [token]);

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
    });
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  // Join the selected thread room
  useEffect(() => {
    if (!socket || !selectedThread?._id) return;
    socket.emit("join", { convId: selectedThread._id }, (resp: any) => {
      setLog((l) => [
        ...l.slice(-80),
        resp?.ok
          ? `joined ${selectedThread._id}`
          : `join failed: ${resp?.error}`,
      ]);
    });
  }, [socket, selectedThread]);

  const loadFollowing = async () => {
    if (!token.trim()) return;
    setToken(token.trim());
    const res = await api.get("/social-feed/golfers/following", {
      params: { page: 1, limit: 50 },
    });
    setFollowing(res.data.data ?? []);
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
      const data = res.data.data ?? res.data ?? [];
      setMessages(
        data
          .map((m: any) => ({
            _id: m._id,
            senderUserId: m.senderUserId,
            text: m.text,
            imageUrl: m.imageUrl,
            createdAt: m.createdAt,
          }))
          .reverse(),
      );
      setLog((l) => [...l.slice(-80), `loaded ${data.length} messages`]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setMessages([]);
      setMessagesError(msg);
      setLog((l) => [...l.slice(-80), `load messages error: ${msg}`]);
    }
  };

  const sendMessage = () => {
    if (!socket || !selectedThread || !text.trim()) return;
    socket.emit(
      "send-msg",
      { convId: selectedThread._id, text },
      (resp: any) =>
        setLog((l) => [
          ...l.slice(-80),
          resp?.ok ? "sent" : `send error: ${resp}`,
        ]),
    );
    setText("");
    setMessages((msgs) => [
      ...msgs,
      {
        _id: `tmp-${Date.now()}`,
        senderUserId: "me",
        text,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      },
    ]);
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
    const res = await api.post("/chat/threads/group", {
      name: groupName.trim(),
      memberUserIds: Array.from(groupMembers),
    });
    setLog((l) => [
      ...l.slice(-80),
      `group created: ${res.data.data?.name ?? res.data.data?._id ?? "ok"}`,
    ]);
    setGroupName("");
    setGroupMembers(new Set());
    await loadThreads();
  };

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h2>Chat Tester</h2>
      <label>JWT:</label>
      <input
        style={{ width: "100%" }}
        value={token}
        onChange={(e) => setJwt(e.target.value)}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={loadFollowing}>Load Following</button>
        <button onClick={loadThreads}>Load Threads</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Following (to find direct peers)</h3>
      <div
        style={{ maxHeight: 200, overflow: "auto", border: "1px solid #ddd" }}
      >
        {following.map((f) => (
          <div
            key={f.golfer._id}
            onClick={() => setSelectedPeer(f.golfer)}
            style={{
              padding: 8,
              borderBottom: "1px solid #eee",
              cursor: "pointer",
              background:
                selectedPeer?._id === f.golfer._id ? "#e8f0ff" : "#fff",
            }}
          >
            {f.golfer.fullName || f.golfer.email || f.golfer._id}
          </div>
        ))}
        {!following.length && (
          <div style={{ padding: 8 }}>No following golfers loaded.</div>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <button
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
              setLog((l) => [...l.slice(-80), `direct error: ${err}`]);
            }
          }}
          style={{ marginTop: 4 }}
        >
          Create / Load Direct Thread
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Direct Threads</h3>
      <div
        style={{ maxHeight: 200, overflow: "auto", border: "1px solid #ddd" }}
      >
        {threads
          .filter((t) => t.type === "direct")
          .map((t) => (
            <div
              key={t._id}
              onClick={async () => {
                setSelectedThread(t);
                await loadMessages(t._id);
              }}
              style={{
                padding: 8,
                cursor: "pointer",
                background:
                  selectedThread?._id === t._id ? "#e8f0ff" : "#fff",
                borderBottom: "1px solid #eee",
              }}
            >
              {t.directPeer?.fullName ||
                t.directPeer?.email ||
                `DM ${t._id.slice(-6)}`}
            </div>
          ))}
        {!threads.some((t) => t.type === "direct") && (
          <div style={{ padding: 8 }}>
            No direct threads. Create one via backend then reload.
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 16 }}>Group Threads</h3>
      <div
        style={{ maxHeight: 200, overflow: "auto", border: "1px solid #ddd" }}
      >
        {threads
          .filter((t) => t.type === "group")
          .map((t) => (
            <div
              key={t._id}
              onClick={async () => {
                setSelectedThread(t);
                await loadMessages(t._id);
              }}
              style={{
                padding: 8,
                cursor: "pointer",
                background:
                  selectedThread?._id === t._id ? "#e8f0ff" : "#fff",
                borderBottom: "1px solid #eee",
              }}
            >
              {t.name || `Group ${t._id}`}
            </div>
          ))}
        {!threads.some((t) => t.type === "group") && (
          <div style={{ padding: 8 }}>No groups loaded.</div>
        )}
      </div>

      <h4 style={{ marginTop: 12 }}>Create Group</h4>
      <input
        style={{ width: "100%", marginBottom: 8 }}
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <div
        style={{
          maxHeight: 120,
          overflow: "auto",
          border: "1px solid #ddd",
          padding: 8,
          marginBottom: 8,
        }}
      >
        {following.map((f) => (
          <label key={f.golfer._id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={groupMembers.has(f.golfer._id)}
              onChange={() => toggleMember(f.golfer._id)}
            />
            &nbsp;{f.golfer.fullName || f.golfer.email || f.golfer._id}
          </label>
        ))}
        {!following.length && <div>Load following to pick members.</div>}
      </div>
      <button onClick={createGroup}>Create Group</button>

      {selectedThread && (
        <>
          <h3 style={{ marginTop: 16 }}>
            Chat in {selectedThread.name || selectedThread._id}
          </h3>
          <div
            style={{
              border: "1px solid #ddd",
              padding: 8,
              maxHeight: 240,
              overflow: "auto",
              background: "#111",
              color: "#ddd",
            }}
          >
            {messages.map((m) => (
              <div key={m._id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {m.senderUserId} · {new Date(m.createdAt).toLocaleTimeString()}
                </div>
                <div>{m.text || "[media]"}</div>
              </div>
            ))}
            {messagesError && (
              <div style={{ color: "#f88" }}>Error: {messagesError}</div>
            )}
            {!messages.length && !messagesError && <div>No history</div>}
          </div>
          <textarea
            rows={3}
            style={{ width: "100%" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
          />
          <button onClick={sendMessage} style={{ marginTop: 8 }}>
            Send Message
          </button>
        </>
      )}

      <h3 style={{ marginTop: 16 }}>Log</h3>
      <div
        style={{
          maxHeight: 160,
          overflow: "auto",
          fontSize: 12,
          border: "1px solid #ddd",
          padding: 8,
        }}
      >
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
