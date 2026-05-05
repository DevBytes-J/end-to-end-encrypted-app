import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useApp } from "../store/AppContext";
import * as api from "../lib/api";
import * as cryptoLib from "../lib/crypto";
import { wsManager } from "../lib/ws";
import styles from "./Chat.module.css";

interface Props {
  partnerId: string;
  partnerName: string;
  partnerUsername: string;
  onBack?: () => void;
}

export default function Chat({ partnerId, partnerName, partnerUsername, onBack }: Props) {
  const { state, dispatch, decryptAndStore } = useApp();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [wsConnected, setWsConnected] = useState(wsManager.connected);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = state.messages[partnerId] ?? [];

  // Load initial history
  const loadHistory = useCallback(async (before?: string) => {
    setLoadingHistory(true);
    try {
      const raw = await api.getMessages(partnerId, before);
      if (raw.length < 50) setHasMore(false);
      // decrypt all
      const decrypted = await Promise.all(
        raw.map(async (m) => {
          const isSender = m.from_user_id === state.user!.id;
          let text: string | null = null;
          try { text = await cryptoLib.decryptMessage(m.payload as cryptoLib.EncryptedPayload, state.user!.privateKey, isSender); }
          catch { /* failed */ }
          return { id: m.id, from_user_id: m.from_user_id, to_user_id: m.to_user_id, text, created_at: m.created_at };
        })
      );
      // raw is newest-first, reverse for display
      const ordered = [...decrypted].reverse();
      if (before) {
        dispatch({ type: "PREPEND_MESSAGES", partnerId, messages: ordered });
      } else {
        dispatch({ type: "SET_MESSAGES", partnerId, messages: ordered });
        setHasMore(true);
      }
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }, [partnerId, state.user, dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [partnerId, loadHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // WebSocket incoming messages
  useEffect(() => {
    const unsub: () => void = wsManager.onMessage((msg) => {
      const partner = msg.from_user_id === state.user!.id ? msg.to_user_id : msg.from_user_id;
      if (partner === partnerId) {
        decryptAndStore(msg, partnerId);
        // update conversation list timestamp
        dispatch({
          type: "UPSERT_CONVERSATION",
          conv: { user_id: partnerId, display_name: partnerName, username: partnerUsername, last_message_at: msg.created_at },
        });
      }
    });
    return unsub;
  }, [partnerId, state.user, decryptAndStore, dispatch, partnerName, partnerUsername]);

  // Track WS connection status
  useEffect(() => {
    const interval = setInterval(() => setWsConnected(wsManager.connected), 2000);
    return () => clearInterval(interval);
  }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      // Get recipient public key
      const { public_key: recipientPubKey } = await api.getUserPublicKey(partnerId);
      const payload = await cryptoLib.encryptMessage(trimmed, recipientPubKey, state.user!.public_key);

      let sent = false;
      if (wsManager.connected) {
        sent = wsManager.send({ event: "message.send", to: partnerId, payload });
      }
      if (!sent) {
        const msg = await api.sendMessageRest(partnerId, payload);
        await decryptAndStore(msg, partnerId);
      } else {
        // Optimistically add — WS echo will be deduped
        const optimistic = {
          id: `opt-${Date.now()}`,
          from_user_id: state.user!.id,
          to_user_id: partnerId,
          text: trimmed,
          created_at: new Date().toISOString(),
        };
        dispatch({ type: "ADD_MESSAGE", partnerId, message: optimistic });
      }
      dispatch({
        type: "UPSERT_CONVERSATION",
        conv: { user_id: partnerId, display_name: partnerName, username: partnerUsername, last_message_at: new Date().toISOString() },
      });
      setText("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function loadMore() {
    if (!hasMore || loadingHistory || messages.length === 0) return;
    loadHistory(messages[0].created_at);
  }

  return (
    <div className={styles.chat}>
      <div className={styles.header}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <div className={styles.headerAvatar}>{partnerName[0].toUpperCase()}</div>
        <div>
          <div className={styles.headerName}>{partnerName}</div>
          <div className={styles.headerSub}>@{partnerUsername}</div>
        </div>
        <div className={`${styles.e2eeBadge} ${wsConnected ? styles.online : styles.offline}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a9 9 0 0 0-9 9v3H1v10h22V13h-2v-3A9 9 0 0 0 12 1zm0 2a7 7 0 0 1 7 7v3H5v-3a7 7 0 0 1 7-7zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
          </svg>
          End-to-end encrypted
        </div>
      </div>

      <div className={styles.messages}>
        {hasMore && (
          <button className={styles.loadMore} onClick={loadMore} disabled={loadingHistory}>
            {loadingHistory ? "Loading…" : "Load older messages"}
          </button>
        )}
        {messages.map((m) => {
          const isMine = m.from_user_id === state.user!.id;
          return (
            <div key={m.id} className={`${styles.bubble} ${isMine ? styles.mine : styles.theirs}`}>
              {m.text === null ? (
                <span className={styles.decryptFail}>Could not decrypt</span>
              ) : (
                <span>{m.text}</span>
              )}
              <time className={styles.time}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className={styles.inputRow} onSubmit={send}>
        <input
          className={styles.input}
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          maxLength={4000}
        />
        <button className={styles.sendBtn} type="submit" disabled={sending || !text.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
