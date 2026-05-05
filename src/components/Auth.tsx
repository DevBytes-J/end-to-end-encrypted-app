import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../store/AppContext";
import styles from "./Auth.module.css";

const NexusIcon = ({ size = 38 }: { size?: number }) => (
  <img
    src="/logo.png"
    alt="Nexus"
    width={size}
    height={size}
    style={{ borderRadius: "11px" }}
  />
);

function Splash({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 500);
    }, 9000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`${styles.splash} ${exiting ? styles.exit : ""}`}>
      <div className={styles.splashLogo}>
        <img src="/logo.png" alt="Nexus" className={styles.splashLogoImg} />
      </div>{" "}
      <p className={styles.splashTagline}>End-to-end encrypted</p>
      <div className={styles.splashSpinner} />
    </div>
  );
}

export default function Auth() {
  const { login, register } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
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

  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <NexusIcon size={44} />
          <span>Nexus</span>
        </div>
        <p className={styles.tagline}>End-to-end encrypted messaging</p>

        <div className={styles.tabs}>
          <button
            className={mode === "login" ? styles.activeTab : styles.tab}
            onClick={() => setMode("login")}
          >
            Sign In
          </button>
          <button
            className={mode === "register" ? styles.activeTab : styles.tab}
            onClick={() => setMode("register")}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Username</span>
            <input
              className={styles.input}
              placeholder="e.g. johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
            />
          </label>
          {mode === "register" && (
            <label className={styles.field}>
              <span className={styles.label}>Display Name</span>
              <input
                className={styles.input}
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={128}
              />
            </label>
          )}
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={8}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        {mode === "register" && (
          <p className={styles.notice}>
            Your private key is generated locally and never sent to the server.
          </p>
        )}
      </div>
    </div>
  );
}
