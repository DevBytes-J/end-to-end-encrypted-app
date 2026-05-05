import { useState } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import EmptyState from "./components/EmptyState";
import Search from "./components/Search";
import "./index.css";

interface ActiveChat { userId: string; displayName: string; username: string; }
type View = "sidebar" | "chat" | "search";

function AppShell() {
  const { state } = useApp();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [view, setView] = useState<View>("sidebar");

  if (!state.user) return <Auth />;

  function handleSelect(userId: string, displayName: string, username: string) {
    setActiveChat({ userId, displayName, username });
    setView("chat");
  }

  function handleBack() {
    setView("sidebar");
  }

  return (
    <div className="shell">
      {/* Sidebar — hidden on mobile when chat/search is open */}
      <div className={`shell-sidebar ${view !== "sidebar" ? "shell-hidden-mobile" : ""}`}>
        <Sidebar
          onSelect={handleSelect}
          onSearchOpen={() => setView("search")}
        />
      </div>

      {/* Main area — hidden on mobile when sidebar is shown */}
      <div className={`shell-main ${view === "sidebar" ? "shell-hidden-mobile" : ""}`}>
        {view === "search" ? (
          <Search onSelect={handleSelect} onBack={handleBack} />
        ) : activeChat ? (
          <Chat
            key={activeChat.userId}
            partnerId={activeChat.userId}
            partnerName={activeChat.displayName}
            partnerUsername={activeChat.username}
            onBack={handleBack}
          />
        ) : (
          <EmptyState />
        )}
      </div>
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
