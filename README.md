# Nexus — End-to-End Encrypted Messaging

A secure messaging application built with React + TypeScript + Vite using the Web Crypto API. The server is zero-knowledge — it stores and forwards only ciphertext and never sees plaintext.

---

## Getting Started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
```

---

## Architecture

```
Browser
  UI Components (Auth / Chat / Sidebar)
        |
  AppContext (useReducer) — auth, conversations, messages
        |
  ┌─────────────┬──────────────┐
  crypto.ts   api.ts         ws.ts
  Web Crypto   REST client    WebSocket
        |              |
        HTTPS          WSS
              |
        whisperbox.koyeb.app
        - Stores encrypted blobs verbatim
        - Never decrypts or inspects payload
        - Issues JWT access + refresh tokens
        - Relays messages over WebSocket
```

---

## Encryption Flow

### Registration

```
password + random 128-bit salt
        |
        PBKDF2 (SHA-256, 310,000 iterations)
   256-bit AES-GCM wrapping key  (never stored)
        |
        AES-GCM encrypt(PKCS8(RSA private key))
   wrapped_private_key  -> stored on server (opaque blob)

   RSA-OAEP public key  -> stored on server
```

### Login

```
server returns: wrapped_private_key + pbkdf2_salt
        |
        re-derive AES-GCM key from password + salt
        AES-GCM decrypt
   RSA private key  -> held in JS memory only, never written to disk
```

### Sending a Message

```
plaintext
    |
    random 256-bit AES-GCM key + 96-bit IV (per message)
ciphertext

AES key -> RSA-OAEP encrypt(recipient public key) -> encryptedKey
AES key -> RSA-OAEP encrypt(sender public key)    -> encryptedKeyForSelf

{ ciphertext, iv, encryptedKey, encryptedKeyForSelf } -> server (opaque)
```

### Receiving a Message

```
encryptedKey
    |
    RSA-OAEP decrypt(your private key)
AES-GCM key
    |
    AES-GCM decrypt(ciphertext, iv)
plaintext
```

---

## Key Management

| Key | Where generated | Where stored | How protected |
|-----|----------------|--------------|---------------|
| RSA-OAEP keypair | Browser (Web Crypto) | Public key on server; private key never sent raw | Private key wrapped with AES-GCM before leaving browser |
| AES-GCM wrapping key | Derived at login | Never stored anywhere | Derived on-demand from password + salt via PBKDF2 |
| Per-message AES-GCM key | Browser (Web Crypto) | Never stored | Encrypted with RSA-OAEP for recipient and sender |
| JWT access token | Server-issued | JS memory only (no localStorage) | Expires after 15 minutes |
| JWT refresh token | Server-issued | JS memory only | Used only to refresh access token |

---

## Tech Stack

- React 19 + TypeScript — UI
- Vite — build tool
- Web Crypto API — all cryptographic operations (no third-party crypto libraries)
- WebSocket — real-time messaging with auto-reconnect
- CSS Modules — scoped styling

---

## Project Structure

```
src/
├── lib/
│   ├── crypto.ts      # Key gen, wrap/unwrap, encrypt/decrypt
│   ├── api.ts         # Typed REST client with auto token refresh
│   └── ws.ts          # WebSocket manager with close-code handling
├── store/
│   └── AppContext.tsx  # Global state — auth, conversations, messages
├── components/
│   ├── Auth.tsx        # Login / register form + splash screen
│   ├── Sidebar.tsx     # Conversation list + user search
│   ├── Chat.tsx        # Message thread, send form, pagination
│   └── EmptyState.tsx  # Placeholder when no chat selected
└── App.tsx             # Root — switches between Auth and Chat views
```

---

## Security Design

### What the server never sees
- Plaintext messages
- Private keys (only the AES-GCM wrapped blob is stored)
- The wrapping key (derived client-side from password + salt, never transmitted)

### Threat mitigations
- XSS token theft: tokens stored in JS memory only, never localStorage
- Brute-force key derivation: PBKDF2 with 310,000 iterations (OWASP 2024)
- Message tampering: AES-GCM provides authenticated encryption — any tampering causes decryption failure, shown as "Could not decrypt"
- Wrong recipient decryption: RSA-OAEP decryption fails silently, surfaced gracefully in UI

### Known limitations
- No Perfect Forward Secrecy — static RSA keys mean past messages are exposed if private key is compromised
- Metadata leakage — server sees who messages whom and when
- No multi-device support — private key is derived per session from password
- No message deletion — server API does not expose a delete endpoint
- No group messaging — only 1-to-1 conversations

---

## API

Base URL: `https://whisperbox.koyeb.app`
Docs: `https://whisperbox.koyeb.app/docs`
