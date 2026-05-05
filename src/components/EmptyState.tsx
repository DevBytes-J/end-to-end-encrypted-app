import styles from "./EmptyState.module.css";

export default function EmptyState() {
  return (
    <div className={styles.wrap}>
      <div className={styles.iconWrap}>
        <img src="/logo.png" alt="Nexus" width={48} height={48} style={{ borderRadius: '12px' }} />
      </div>
      <h2>Nexus</h2>
      <p>Select a conversation or search for a user to start messaging.</p>
      <p className={styles.sub}>All messages are end-to-end encrypted. The server never sees your plaintext.</p>
    </div>
  );
}
