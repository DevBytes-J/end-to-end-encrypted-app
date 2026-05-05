import { useState } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import EmptyState from "./components/EmptyState";
import "./index.css";

interface ActiveChat { userId: string; displayName: string; username: string; }

function AppShell() {
  const { state } = useApp();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  if (!state.user) return <Auth />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar onSelect={(userId, displayName, username) => setActiveChat({ userId, displayName, username })} />
      {activeChat
        ? <Chat key={activeChat.userId} partnerId={activeChat.userId} partnerName={activeChat.displayName} partnerUsername={activeChat.username} />
        : <EmptyState />
      }
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
