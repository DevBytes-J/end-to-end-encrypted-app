# WhisperBox — End-to-End Encrypted Messaging

A secure messaging application built with React + TypeScript + Vite using the Web Crypto API. The server is zero-knowledge — it stores and forwards only ciphertext and never sees plaintext.

## 🚀 Getting Started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────────┐ │
│  │  Auth UI  │   │ Chat UI  │   │    Sidebar / Search │ │
│  └────┬─────┘   └────┬─────┘   └──────────┬──────────┘ │
│       │              │                     │            │
│  ┌────▼──────────────▼─────────────────────▼──────────┐ │
│  │              AppContext (useReducer)                │ │
│  │         auth · conversations · messages            │ │
│  └────┬──────────────┬──────────────────────────────┬─┘ │
│       │              │                              │   │
│  ┌────▼────┐   ┌─────▼─────┐              ┌────────▼─┐ │
│  │crypto.ts│   │  api.ts   │              │  ws.ts   │ │
│  │Web Crypto│  │REST client│              │WebSocket │ │
│  └─────────┘   └─────┬─────┘              └────┬─────┘ │
└────────────────────── │ ────────────────────── │ ───────┘
                        │ HTTPS                  │ WSS
               ┌────────▼────────────────────────▼───────┐
               │         whisperbox.koyeb.app             │
               │                                          │
               │  • Stores encrypted blobs verbatim       │
               │  • Never decrypts or inspects payload    │
               │  • Issues JWT access + refresh tokens    │
               │  • Relays messages over WebSocket        │
               └──────────────────────────────────────────┘
```

---

## 🔐 Encryption Flow

### Key Setup (Registration)

```
password + random 128-bit salt
        │
        ▼ PBKDF2 (SHA-256, 310,000 iterations)
   256-bit AES-GCM key  ◄── wrapping key (never stored)
        │
        ▼ AES-GCM encrypt(pkcs8(RSA private key))
   wrapped_private_key  ──► stored on server (opaque blob)

   RSA-OAEP public key  ──► stored on server (used by others to encrypt for you)
```

### Session Restore (Login)

```
server returns: wrapped_private_key + pbkdf2_salt
        │
        ▼ re-derive AES-GCM key from password + salt
        ▼ AES-GCM decrypt
   RSA private key  ──► held in JS memory only, never written to disk
```

### Sending a Message

```
plaintext
    │
    ▼ random 256-bit AES-GCM key + 96-bit IV (per message)
ciphertext

AES key ──► RSA-OAEP encrypt(recipient public key) ──► encryptedKey
AES key ──► RSA-OAEP encrypt(sender public key)    ──► encryptedKeyForSelf

{ ciphertext, iv, encryptedKey, encryptedKeyForSelf }  ──► server (opaque)
```

### Receiving a Message

```
encryptedKey
    │
    ▼ RSA-OAEP decrypt(your private key)
AES-GCM key
    │
    ▼ AES-GCM decrypt(ciphertext, iv)
plaintext
```

---

## 🗝️ Key Management

| Key | Where generated | Where stored | How protected |
|-----|----------------|--------------|---------------|
| RSA-OAEP keypair | Browser (Web Crypto) | Public key on server; private key never sent raw | Private key wrapped with AES-GCM before leaving browser |
| AES-GCM wrapping key | Derived at login | Never stored anywhere | Derived on-demand from password + salt via PBKDF2 |
| Per-message AES-GCM key | Browser (Web Crypto) | Never stored | Encrypted with RSA-OAEP for recipient and sender |
| JWT access token | Server-issued | JS memory only (no localStorage) | Expires after 15 minutes |
| JWT refresh token | Server-issued | JS memory only | Used only to refresh access token |

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — build tool
- **Web Crypto API** — all cryptographic operations (no crypto libraries)
- **WebSocket** — real-time messaging with auto-reconnect
- **CSS Modules** — scoped styling

---

## 📁 Project Structure

```
src/
├── lib/
│   ├── crypto.ts      # Key gen, wrap/unwrap, encrypt/decrypt
│   ├── api.ts         # Typed REST client with auto token refresh
│   └── ws.ts          # WebSocket manager with close-code handling
├── store/
│   └── AppContext.tsx  # Global state — auth, conversations, messages
├── components/
│   ├── Auth.tsx        # Login / register form
│   ├── Sidebar.tsx     # Conversation list + user search
│   ├── Chat.tsx        # Message thread, send form, pagination
│   └── EmptyState.tsx  # Placeholder when no chat selected
└── App.tsx             # Root — switches between Auth and Chat views
```

---

## 🏛️ Architecture Overview

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S DEVICE (React App)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                   ┌─────────────────┐   │
│  │   UI Components  │                   │   AppContext    │   │
│  │  (Auth/Chat)     │◄──────────────────│  (State Mgmt)   │   │
│  └─────────────┬────┘                   └────────┬────────┘   │
│                │                                  │             │
│                ▼                                  ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Cryptography Layer                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  • RSA-2048 Key Pair Generation                   │  │  │
│  │  │  • PBKDF2 (310k iterations, SHA-256)              │  │  │
│  │  │  • AES-GCM-256 Message Encryption                 │  │  │
│  │  │  • Private Key Wrapping/Unwrapping               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Communication Layers                             │  │
│  │  ┌──────────────────┐    ┌─────────────────────────────┐│  │
│  │  │  WebSocket (WSS) │    │  REST/HTTPS API             ││  │
│  │  │ (Real-time msgs) │    │ (Fallback, auth, etc)       ││  │
│  │  │ Auto-reconnect   │    │ JWT Token-based auth        ││  │
│  │  └──────────────────┘    └─────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────┘  │
│                ▼                                                │
└─────────────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    HTTPS Connection            WSS Connection
            │                           │
            ▼                           ▼
┌─────────────────────────────────────────────────┐
│        Backend: https://whisperbox.koyeb.app   │
├─────────────────────────────────────────────────┤
│  • User Identity Management                     │
│  • Encrypted Message Storage (ciphertext only)  │
│  • Public Key Directory                         │
│  • JWT Authentication (15-min expiry)           │
│  • WebSocket Message Relay                      │
│  • NEVER sees plaintext                         │
└─────────────────────────────────────────────────┘
```

### Component Architecture

```
App (Root)
├── AppProvider (Context + Reducer)
│   └── AppShell (Conditional rendering)
│       ├── Auth (login/register) — if !user
│       └── MainLayout — if user
│           ├── Sidebar (conversations + search)
│           └── Chat or EmptyState
```

**Key Files:**
- `src/lib/crypto.ts` — All cryptographic operations (Web Crypto API)
- `src/lib/api.ts` — Typed HTTP client with token refresh logic
- `src/lib/ws.ts` — WebSocket manager with auto-reconnect and session handling
- `src/store/AppContext.tsx` — Global state management with useReducer
- `src/components/*` — UI components (Auth, Sidebar, Chat, EmptyState)

---

## 🔐 Detailed Encryption Flow

### 1. **Registration Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ Client (Browser)                                                │
│                                                                  │
│  1. User enters: username, display_name, password              │
│     ▼                                                            │
│  2. Generate Random Salt (16 bytes)                            │
│     salt = crypto.getRandomValues(new Uint8Array(16))          │
│     ▼                                                            │
│  3. Generate RSA-OAEP 2048-bit Keypair                        │
│     {publicKey, privateKey} = crypto.subtle.generateKey(...)   │
│     ▼                                                            │
│  4. Wrap Private Key with Password                            │
│     a) Derive AES-GCM key from password:                       │
│        baseKey = PBKDF2(password, salt, 310k iterations)      │
│     b) Generate random IV (12 bytes)                           │
│     c) Encrypt privateKey PKCS8 with AES-GCM                  │
│        wrappedPrivateKey = AES-GCM-Enc(baseKey, IV, PKCS8)    │
│     d) Prepend IV + encrypted data (for recovery)             │
│     ▼                                                            │
│  5. Export Public Key (SPKI → Base64)                        │
│     publicKeyB64 = base64(publicKey.SPKI)                     │
│     ▼                                                            │
│  6. Send to Server:                                            │
│     POST /auth/register {                                      │
│       username, display_name, password,                        │
│       public_key: publicKeyB64,                                │
│       wrapped_private_key: wrappedPrivateKeyB64,              │
│       pbkdf2_salt: saltB64                                     │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─── HTTPS ────►  ┌─────────────────────────────────────────┐
                      │ Server                                   │
                      │                                          │
                      │  • Validate input                        │
                      │  • Hash password with bcrypt            │
                      │  • Store:                               │
                      │    - username, display_name             │
                      │    - public_key (never decrypted)       │
                      │    - wrapped_private_key (never seen)   │
                      │    - pbkdf2_salt (never seen)           │
                      │    - password_hash                       │
                      │                                          │
                      │  • Return JWT tokens                     │
                      └─────────────────────────────────────────┘
     │
     ◄─── HTTPS ───  {access_token, refresh_token, user}
     │
  7. Client stores tokens in memory only (no localStorage)
  8. PrivateKey remains in RAM as CryptoKey object
```

### 2. **Login Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ Client                                                          │
│                                                                  │
│  1. User enters: username, password                            │
│     ▼                                                            │
│  2. POST /auth/login {username, password}                     │
│     (HTTPS, plain password over encrypted connection)          │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─── HTTPS ────►  Server verifies bcrypt(password)
     │                 Returns: {access_token, refresh_token,
     │                            user {wrapped_private_key,
     │                                   pbkdf2_salt, ...}}
     │
     ◄─── HTTPS ───  Encrypted response
     │
  3. Client receives wrapped_private_key + salt
     ▼
  4. Derive AES-GCM key from password (same as registration):
     baseKey = PBKDF2(password, saltB64, 310k, SHA-256)
     ▼
  5. Unwrap Private Key:
     pkcs8 = AES-GCM-Dec(baseKey, IV=first12bytes, ciphertext)
     privateKey = import(PKCS8)  ← CryptoKey in memory
     ▼
  6. Connect WebSocket (if available)
  7. Private key NEVER written to disk
     NEVER sent over network (only wrapped version)
     ONLY in RAM as CryptoKey object
```

### 3. **Message Send Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ Sender (Alice)                                                  │
│                                                                  │
│  1. User types message: "Hello Bob"                            │
│     ▼                                                            │
│  2. Fetch Recipient's Public Key:                             │
│     GET /users/{bob_id}/public-key                            │
│     Response: {public_key: bobPublicKeyB64}                    │
│     ▼                                                            │
│  3. Generate Message Encryption Key:                          │
│     msgKey = AES-GCM-256 random key                           │
│     msgIV = random 12 bytes                                    │
│     ▼                                                            │
│  4. Encrypt Message Content:                                  │
│     ciphertext = AES-GCM-Enc(msgKey, msgIV, "Hello Bob")     │
│     ▼                                                            │
│  5. Encrypt Message Key (for Bob):                           │
│     encryptedKeyForBob = RSA-OAEP-Enc(bobPublicKey, msgKey)  │
│     ▼                                                            │
│  6. Encrypt Message Key (for Self — sent messages view):     │
│     encryptedKeyForSelf = RSA-OAEP-Enc(alicePublicKey, msgKey)
│     ▼                                                            │
│  7. Create Payload:                                           │
│     payload = {                                                │
│       ciphertext: base64(ciphertext),                         │
│       iv: base64(msgIV),                                      │
│       encryptedKey: base64(encryptedKeyForBob),              │
│       encryptedKeyForSelf: base64(encryptedKeyForSelf)       │
│     }                                                            │
│     ▼                                                            │
│  8. Send via WebSocket (if connected) or REST:               │
│     {event: "message.send", to: bob_id, payload}             │
│     OR POST /messages {to: bob_id, payload}                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─── WSS/HTTPS ────►  Server
                          • Stores encrypted payload verbatim
                          • No decryption attempt
                          • Broadcasts to recipient if online (WSS)
```

### 4. **Message Receive Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ Recipient (Bob)                                                 │
│                                                                  │
│  1. Receive encrypted payload via WebSocket:                  │
│     {                                                            │
│       event: "message.receive",                               │
│       id: msg_id,                                             │
│       from_user_id: alice_id,                                 │
│       to_user_id: bob_id,                                     │
│       payload: {                                              │
│         ciphertext: "...",                                    │
│         iv: "...",                                            │
│         encryptedKey: "...",  ← encrypted for Bob             │
│         encryptedKeyForSelf: "..."                            │
│       }                                                         │
│     }                                                            │
│     ▼                                                            │
│  2. Decrypt Message Key (using Bob's private key):          │
│     msgKey = RSA-OAEP-Dec(bobPrivateKey, encryptedKey)      │
│     ▼                                                            │
│  3. Decrypt Message Content:                                 │
│     plaintext = AES-GCM-Dec(msgKey, iv, ciphertext)         │
│     ▼                                                            │
│  4. Display: "Hello Bob"                                      │
│     ▼                                                            │
│  5. Catch decryption errors gracefully:                      │
│     ⚠ Could not decrypt  (if key mismatch, tampering, etc)  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. **Decryption Error Handling**

- **Tampering detection**: AES-GCM includes authentication tag. Failure throws error → caught
- **Wrong recipient**: If ciphertext encrypted for different user, RSA decryption fails
- **Decrypted but corrupted**: TextDecoder fails gracefully
- **Result**: Message shows `⚠ Could not decrypt` instead of app crash

---

## 🔑 Key Management Explanation

### Private Key Lifecycle

| Stage | Location | Format | Access | Risk |
|-------|----------|--------|--------|------|
| **Generation** | Browser RAM | CryptoKey | Client only | None (local) |
| **Wrapping** | Browser RAM | String (Base64) | Client | Vulnerable if localStorage used — we use memory |
| **Transmission** | Network | HTTPS | Client → Server | Mitigated by HTTPS + wrapping |
| **Storage** | Server DB | Base64 blob | Never accessed | Safe — wrapped + server doesn't unwrap |
| **At Login** | Browser RAM | CryptoKey | Client only | Safe — memory-only, cleared on logout |

### Key Details

- **Generation**: RSA-OAEP 2048-bit via `crypto.subtle.generateKey()`
  - Extractable: `true` (necessary to wrap and export)
  - Usage: `["encrypt", "decrypt"]`
  
- **Wrapping Strategy**: PBKDF2 → AES-GCM
  - Why not AES-KW? RSA-2048 PKCS8 is 1218 bytes (not multiple of 8)
  - PBKDF2: 310,000 iterations (OWASP 2024 recommendation)
  - Salt: 16 random bytes, different per user
  - Result: Only user + password can unwrap private key

- **Token Management**:
  - Access Token: 15-minute expiry
  - Refresh Token: Longer expiry (server-side)
  - Storage: Memory only (cleared on page reload/logout)
  - Auto-refresh: Triggered before expiry or on 401 response

---

## ⚖️ Security Trade-offs & Known Limitations

### Trade-offs (Intentional Design Decisions)

| Trade-off | Why | Mitigation |
|-----------|-----|-----------|
| **Tokens in memory only** | Prevents localStorage XSS attacks | Requires page reload to lose session; acceptable for messaging |
| **No persistent login** | More secure, less convenient | WebSocket + background refresh keeps session alive during use |
| **PBKDF2 310k iterations** | Slower but OWASP-recommended | ~100ms per login acceptable for security UX |
| **RSA-2048** | Older than 4096 but still secure for now | Acceptable for 2024-2026; can upgrade if backend supports |
| **Fixed IV prepended to ciphertext** | No IV randomness per file, only per message | AES-GCM IV reuse with same key = vulnerability. We generate new msgKey per message so IV isn't reused. **Safe.** |
| **No forward secrecy (PFS)** | Static RSA keys don't change per session | Acceptable for async messaging (not real-time sessions) |
| **Decryption failures silent** | Doesn't alert user to tampering | Shows `⚠ Could not decrypt` so user is aware |

### Known Limitations

1. **No Perfect Forward Secrecy (PFS)**
   - Message keys are encrypted with static RSA public keys
   - If private key compromised, all past messages exposed
   - **Mitigation**: Use for non-sensitive data or implement key rotation (backend change)

2. **No Replay Attack Protection**
   - Old messages can be re-sent by attacker (server would relay)
   - **Why not fixed**: Adds complexity; timestamps alone aren't enough (clock skew)
   - **Mitigation**: Unique message IDs on server prevent duplicates; WebSocket deduplication on client

3. **No End-to-End Message Integrity Verification**
   - Server could reorder messages (though timestamps help)
   - **Mitigation**: AES-GCM provides authenticated encryption (detects tampering in transit)

4. **No Secure Deletion**
   - Decrypted messages stay in React state (memory)
   - Page reload clears state; no guaranteed secure wipe
   - **Mitigation**: Browser memory is cleared on process exit; acceptable for typical users

5. **No Multi-Device Support**
   - Logging in on new device requires re-deriving private key from password
   - No way to securely sync sessions
   - **Mitigation**: Accept as limitation; use same device for convenience

6. **Metadata Leakage**
   - Server sees: who messages whom, when, message count, frequency
   - **Mitigation**: None in this design. Use Tor/VPN if metadata privacy needed.

7. **No Group Messaging**
   - Only 1-to-1 conversations supported
   - **Mitigation**: Scale to multi-recipient by encrypting message key N times (one per recipient)

8. **No Message Read Receipts**
   - Prevents tracking but reduces UX
   - **Mitigation**: Could add optional read receipts encrypted with recipient's key

9. **Decryption Happens Client-Side**
   - Large message history → long decryption time
   - **Mitigation**: Pagination (currently loads 50 messages at a time)

10. **No Backup/Recovery**
    - Lose password? Lose access forever (no password reset without compromising E2EE)
    - **Mitigation**: Accept risk or implement social recovery (complex, not implemented)
- **No message deletion** — the server API does not expose a delete endpoint.
- **Replay attack mitigation** — AES-GCM with a random IV per message prevents ciphertext reuse, but the server could theoretically replay old encrypted messages. A sequence number or timestamp commitment scheme would fully prevent this.

---

## 📡 API

Base URL: `https://whisperbox.koyeb.app`  
Docs: `https://whisperbox.koyeb.app/docs`

---

## 📝 License

MIT
