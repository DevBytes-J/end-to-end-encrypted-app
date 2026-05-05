import { useState, useEffect, useCallback } from "react";
import { useApp, useAuth } from "../store/AppContext";
import * as api from "../lib/api";
import styles from "./Sidebar.module.css";

interface Props {
  onSelect: (userId: string, displayName: string, username: string) => void;
}

const NexusIcon = () => (
  <img src="/logo.png" alt="Nexus" width={26} height={26} style={{ borderRadius: '8px' }} />
);

export default function Sidebar({ onSelect }: Props) {
  const { state, dispatch } = useApp();
  const { logout } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<api.UserPublicInfo[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await api.listConversations();
      dispatch({ type: "SET_CONVERSATIONS", conversations: convs });
    } catch { /* ignore */ }
  }, [dispatch]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!query.trim()) { setSearchResults([]); setSearchError(""); return; }
      setSearching(true);
      setSearchError("");
      (async () => {
        try {
          setSearchResults(await api.searchUsers(query.trim()));
        } catch (e) {
          setSearchResults([]);
          setSearchError(e instanceof Error ? e.message : "Search failed");
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  function selectUser(id: string, displayName: string, username: string) {
    setQuery("");
    setSearchResults([]);
    dispatch({ type: "SET_ACTIVE", userId: id });
    onSelect(id, displayName, username);
  }

  const displayList = query.trim() ? searchResults : state.conversations;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <NexusIcon />
          <span>Nexus</span>
        </div>
        <button className={styles.logoutBtn} onClick={logout} title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      <div className={styles.userInfo}>
        <div className={styles.avatar}>{state.user?.display_name[0].toUpperCase()}</div>
        <div>
          <div className={styles.userName}>{state.user?.display_name}</div>
          <div className={styles.userHandle}>@{state.user?.username}</div>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.search}
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <span className={styles.spinner} />}
      </div>

      <div className={styles.listLabel}>{query.trim() ? "Search results" : "Messages"}</div>

      <ul className={styles.list}>
        {displayList.length === 0 && (
          <li className={styles.empty}>
            {searchError
              ? <span style={{ color: "var(--error)" }}>{searchError}</span>
              : query.trim() ? "No users found" : "No conversations yet"}
          </li>
        )}
        {query.trim()
          ? (searchResults as api.UserPublicInfo[]).map((u) => (
              <li key={u.id} className={`${styles.item} ${state.activeConversation === u.id ? styles.active : ""}`}
                onClick={() => selectUser(u.id, u.display_name, u.username)}>
                <div className={styles.itemAvatar}>{u.display_name[0].toUpperCase()}</div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{u.display_name}</span>
                  <span className={styles.itemSub}>@{u.username}</span>
                </div>
              </li>
            ))
          : (state.conversations as api.ConversationSummary[]).map((c) => (
              <li key={c.user_id} className={`${styles.item} ${state.activeConversation === c.user_id ? styles.active : ""}`}
                onClick={() => selectUser(c.user_id, c.display_name, c.username)}>
                <div className={styles.itemAvatar}>{c.display_name[0].toUpperCase()}</div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{c.display_name}</span>
                  <span className={styles.itemSub}>@{c.username}</span>
                </div>
              </li>
            ))
        }
      </ul>
    </aside>
  );
}
