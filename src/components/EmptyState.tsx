import styles from "./EmptyState.module.css";

export default function EmptyState() {
  return (
    <div className={styles.wrap}>
      <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="12" fill="#1e2d5a"/>
        <path d="M20 10a7 7 0 0 0-7 7v2H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2v-2a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5v2H15v-2a5 5 0 0 1 5-5zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#2563eb"/>
      </svg>
      <h2>WhisperBox</h2>
      <p>Select a conversation or search for a user to start messaging.</p>
      <p className={styles.sub}>All messages are end-to-end encrypted. The server never sees your plaintext.</p>
    </div>
  );
}
