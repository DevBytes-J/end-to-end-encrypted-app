import { useEffect, useCallback } from "react";
import { useApp, useAuth } from "../store/AppContext";
import * as api from "../lib/api";
import styles from "./Sidebar.module.css";

interface Props {
  onSelect: (userId: string, displayName: string, username: string) => void;
  onSearchOpen: () => void;
}

const NexusIcon = () => (
  <img src="/logo.png" alt="Nexus" width={26} height={26} style={{ borderRadius: '8px' }} />
);

export default function Sidebar({ onSelect, onSearchOpen }: Props) {
  const { state, dispatch } = useApp();
  const { logout } = useAuth();

  const loadConversations = useCallback(async () => {
    try {
      const convs = await api.listConversations();
      dispatch({ type: "SET_CONVERSATIONS", conversations: convs });
    } catch { /* ignore */ }
  }, [dispatch]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  function selectUser(id: string, displayName: string, username: string) {
    dispatch({ type: "SET_ACTIVE", userId: id });
    onSelect(id, displayName, username);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <NexusIcon />
          <span>Nexus</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={onSearchOpen} title="Search users" aria-label="Search users">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={logout} title="Sign out" aria-label="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.userInfo}>
        <div className={styles.avatar}>{state.user?.display_name[0].toUpperCase()}</div>
        <div>
          <div className={styles.userName}>{state.user?.display_name}</div>
          <div className={styles.userHandle}>@{state.user?.username}</div>
        </div>
      </div>

      <div className={styles.listLabel}>Messages</div>

      <ul className={styles.list}>
        {state.conversations.length === 0 && (
          <li className={styles.empty}>No conversations yet</li>
        )}
        {(state.conversations as api.ConversationSummary[]).map((c) => (
          <li
            key={c.user_id}
            className={`${styles.item} ${state.activeConversation === c.user_id ? styles.active : ""}`}
            onClick={() => selectUser(c.user_id, c.display_name, c.username)}
          >
            <div className={styles.itemAvatar}>{c.display_name[0].toUpperCase()}</div>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{c.display_name}</span>
              <span className={styles.itemSub}>@{c.username}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
