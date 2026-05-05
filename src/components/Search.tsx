import { useState, useEffect } from "react";
import * as api from "../lib/api";
import { useApp } from "../store/AppContext";
import styles from "./Search.module.css";

interface Props {
  onSelect: (userId: string, displayName: string, username: string) => void;
  onBack: () => void;
}

export default function Search({ onSelect, onBack }: Props) {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<api.UserPublicInfo[]>([]);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setError(""); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        setResults(await api.searchUsers(query.trim()));
      } catch (e) {
        setResults([]);
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.input}
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <span className={styles.spinner} />}
        </div>
      </div>

      <ul className={styles.list}>
        {error && <li className={styles.empty} style={{ color: "var(--error)" }}>{error}</li>}
        {!error && query.trim() && results.length === 0 && !searching && (
          <li className={styles.empty}>No users found</li>
        )}
        {!query.trim() && (
          <li className={styles.empty}>Type a name or username to search</li>
        )}
        {results.map((u) => (
          <li
            key={u.id}
            className={`${styles.item} ${state.activeConversation === u.id ? styles.active : ""}`}
            onClick={() => onSelect(u.id, u.display_name, u.username)}
          >
            <div className={styles.avatar}>{u.display_name[0].toUpperCase()}</div>
            <div className={styles.info}>
              <span className={styles.name}>{u.display_name}</span>
              <span className={styles.sub}>@{u.username}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
