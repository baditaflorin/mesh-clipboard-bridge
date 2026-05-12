import { useEffect, useMemo, useState } from "react";
import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Entry = {
  id: string;
  text: string;
  fromPeer: string;
  ts: number;
};

const MAX_ENTRIES = 50;

function shortFrom(id: string) {
  return id.slice(0, 4);
}

export function Feature({ room, config }: Props) {
  void config;
  const [draft, setDraft] = useState("");
  const [, rerender] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<Entry>("clip");
    const onChange = () => rerender((n) => n + 1);
    arr.observe(onChange);
    return () => arr.unobserve(onChange);
  }, [room]);

  const entries = useMemo(() => {
    if (!room) return [] as Entry[];
    return [...room.doc.getArray<Entry>("clip").toArray()].reverse();
  }, [room]);

  if (!room) {
    return (
      <div className="clip-screen">
        <h1>clipboard bridge</h1>
        <p className="clip-status">Connecting…</p>
      </div>
    );
  }

  const send = (text: string) => {
    const trimmed = text;
    if (!trimmed) return;
    const arr = room.doc.getArray<Entry>("clip");
    arr.push([
      {
        id: crypto.randomUUID(),
        text: trimmed,
        fromPeer: room.peerId,
        ts: Date.now(),
      },
    ]);
    // Trim old entries (keep last MAX_ENTRIES).
    while (arr.length > MAX_ENTRIES) {
      arr.delete(0, 1);
    }
    setDraft("");
  };

  const copy = async (e: Entry) => {
    try {
      await navigator.clipboard.writeText(e.text);
      setCopiedId(e.id);
      setTimeout(() => setCopiedId((id) => (id === e.id ? null : id)), 1500);
    } catch {
      // fallback: select the text manually
    }
  };

  const clear = () => {
    const arr = room.doc.getArray<Entry>("clip");
    arr.delete(0, arr.length);
  };

  return (
    <div className="clip-screen">
      <header className="clip-header">
        <h1>clipboard bridge</h1>
        <p className="clip-status">
          {room.peerCount + 1} device{room.peerCount === 0 ? "" : "s"} · open the same URL with the
          same room on every device, then send below
        </p>
      </header>

      <form
        className="clip-send"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="paste or type, then send"
          rows={3}
        />
        <div className="clip-send-actions">
          <button
            type="button"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t) send(t);
              } catch {
                // user denied or browser unsupported
              }
            }}
          >
            paste from clipboard
          </button>
          <button type="submit" disabled={!draft.trim()}>
            send to mesh
          </button>
        </div>
      </form>

      <ul className="clip-list">
        {entries.map((e) => {
          const mine = e.fromPeer === room.peerId;
          return (
            <li key={e.id} className={`clip-entry ${mine ? "is-mine" : ""}`}>
              <div className="clip-entry-meta">
                <span>{mine ? "you" : `peer-${shortFrom(e.fromPeer)}`}</span>
                <span>·</span>
                <span>{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
              <pre className="clip-entry-text">{e.text}</pre>
              <div className="clip-entry-actions">
                <button type="button" onClick={() => copy(e)}>
                  {copiedId === e.id ? "✓ copied" : "copy"}
                </button>
              </div>
            </li>
          );
        })}
        {entries.length === 0 && <li className="clip-empty">nothing shared yet</li>}
      </ul>

      {entries.length > 0 && (
        <button type="button" className="clip-clear" onClick={clear}>
          clear all
        </button>
      )}
    </div>
  );
}
