import { useState, type FormEvent } from "react";
import { useAuth } from "../store/AppContext";
import styles from "./Auth.module.css";

export default function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, displayName, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="#2563eb"/>
            <path d="M20 10a7 7 0 0 0-7 7v2H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2v-2a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5v2H15v-2a5 5 0 0 1 5-5zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="white"/>
          </svg>
          <span>WhisperBox</span>
        </div>
        <p className={styles.tagline}>End-to-end encrypted messaging</p>

        <div className={styles.tabs}>
          <button className={mode === "login" ? styles.activeTab : styles.tab} onClick={() => setMode("login")}>Sign In</button>
          <button className={mode === "register" ? styles.activeTab : styles.tab} onClick={() => setMode("register")}>Create Account</button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
          />
          {mode === "register" && (
            <input
              className={styles.input}
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={128}
            />
          )}
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign In" : "Create Account")}
          </button>
        </form>

        {mode === "register" && (
          <p className={styles.notice}>
            🔒 Your private key is generated locally and never sent to the server.
          </p>
        )}
      </div>
    </div>
  );
}
