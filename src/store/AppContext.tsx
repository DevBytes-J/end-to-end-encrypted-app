/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from "react";
import * as api from "../lib/api";
import * as crypto from "../lib/crypto";
import { wsManager } from "../lib/ws";

export interface AppUser extends api.UserProfile {
  privateKey: CryptoKey;
}

interface State {
  user: AppUser | null;
  conversations: api.ConversationSummary[];
  messages: Record<string, DecryptedMessage[]>;
  activeConversation: string | null;
}

export interface DecryptedMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string | null;
  created_at: string;
}

type Action =
  | { type: "LOGIN"; user: AppUser }
  | { type: "LOGOUT" }
  | { type: "SET_CONVERSATIONS"; conversations: api.ConversationSummary[] }
  | { type: "SET_MESSAGES"; partnerId: string; messages: DecryptedMessage[] }
  | { type: "PREPEND_MESSAGES"; partnerId: string; messages: DecryptedMessage[] }
  | { type: "ADD_MESSAGE"; partnerId: string; message: DecryptedMessage }
  | { type: "SET_ACTIVE"; userId: string | null }
  | { type: "UPSERT_CONVERSATION"; conv: api.ConversationSummary };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOGIN":
      return { ...state, user: action.user };
    case "LOGOUT":
      return { user: null, conversations: [], messages: {}, activeConversation: null };
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.conversations };
    case "SET_MESSAGES":
      return { ...state, messages: { ...state.messages, [action.partnerId]: action.messages } };
    case "PREPEND_MESSAGES": {
      const existing = state.messages[action.partnerId] ?? [];
      return { ...state, messages: { ...state.messages, [action.partnerId]: [...existing, ...action.messages] } };
    }
    case "ADD_MESSAGE": {
      const existing = state.messages[action.partnerId] ?? [];
      if (existing.some((m) => m.id === action.message.id)) return state;
      return { ...state, messages: { ...state.messages, [action.partnerId]: [...existing, action.message] } };
    }
    case "SET_ACTIVE":
      return { ...state, activeConversation: action.userId };
    case "UPSERT_CONVERSATION": {
      const exists = state.conversations.some((c) => c.user_id === action.conv.user_id);
      const convs = exists
        ? state.conversations.map((c) => c.user_id === action.conv.user_id ? action.conv : c)
        : [action.conv, ...state.conversations];
      return { ...state, conversations: convs };
    }
    default:
      return state;
  }
}

const initialState: State = { user: null, conversations: [], messages: {}, activeConversation: null };

interface AppContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  decryptAndStore: (msg: api.MessageResponse, partnerId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue>(null!);

function InnerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const decryptAndStore = useCallback(async (msg: api.MessageResponse, partnerId: string) => {
    const user = state.user;
    if (!user) return;
    const isSender = msg.from_user_id === user.id;
    let text: string | null = null;
    try {
      text = await crypto.decryptMessage(msg.payload as crypto.EncryptedPayload, user.privateKey, isSender);
    } catch { /* decryption failed */ }
    dispatch({
      type: "ADD_MESSAGE",
      partnerId,
      message: { id: msg.id, from_user_id: msg.from_user_id, to_user_id: msg.to_user_id, text, created_at: msg.created_at },
    });
  }, [state.user]);

  // Register WS session-expired handler — force logout on 4001 refresh fail or 4003
  useEffect(() => {
    wsManager.setSessionExpiredHandler(() => {
      api.clearTokens();
      dispatch({ type: "LOGOUT" });
    });
  }, []);

  return <AppContext.Provider value={{ state, dispatch, decryptAndStore }}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return <InnerProvider>{children}</InnerProvider>;
}

export function useApp() { return useContext(AppContext); }

// ── Auth actions ──────────────────────────────────────────────────────────────

export function useAuth() {
  const { dispatch } = useApp();

  const loginAction = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    api.setTokens(res.access_token, res.refresh_token);
    const privateKey = await crypto.unwrapPrivateKey(res.user.wrapped_private_key, password, res.user.pbkdf2_salt);
    dispatch({ type: "LOGIN", user: { ...res.user, privateKey } });
    wsManager.connect();
    return res.user;
  }, [dispatch]);

  const registerAction = useCallback(async (username: string, displayName: string, password: string) => {
    const salt = crypto.generateSalt();
    const kp = await crypto.generateKeyPair();
    const publicKey = await crypto.exportPublicKey(kp.publicKey);
    const wrappedPrivateKey = await crypto.wrapPrivateKey(kp.privateKey, password, salt);
    const res = await api.register({ username, display_name: displayName, password, public_key: publicKey, wrapped_private_key: wrappedPrivateKey, pbkdf2_salt: salt });
    api.setTokens(res.access_token, res.refresh_token);
    dispatch({ type: "LOGIN", user: { ...res.user, privateKey: kp.privateKey } });
    wsManager.connect();
    return res.user;
  }, [dispatch]);

  const logoutAction = useCallback(async () => {
    wsManager.disconnect();
    await api.logout().catch(() => {});
    api.clearTokens();
    dispatch({ type: "LOGOUT" });
  }, [dispatch]);

  return { login: loginAction, register: registerAction, logout: logoutAction };
}
