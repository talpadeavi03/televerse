# Phase 1.2 — Error Transparency Upgrade (Error Scan & Implementation Plan)

This document presents a comprehensive scan of all potential exceptions, library errors, database constraints, and API failures across the **TeleVerse** monorepo. It outlines a modern architecture to eliminate generic `500 Internal Server Error` and `'Request failed'` messages, replacing them with **precise, safe, and actionable issue descriptions** returned directly to the client interface.

---

## 1. Executive Summary & Core Objective

Currently, when unexpected failures occur in third-party integrations (such as Telegram MTProto hangups, database connection drops, or model rate limits), the user sees generic errors:
* **Backend**: The global Fastify error handler intercepts any unhandled exception (without a specified `.statusCode` or when `statusCode >= 500`) and masks it as `"Internal Server Error"` with an `"INTERNAL_ERROR"` code.
* **Frontend**: The React Fetch API client falls back to `"Request failed"` if it cannot parse the JSON error body or if the backend returns an Nginx-level `502 Bad Gateway` / `504 Gateway Timeout`.

### 🎯 The Objective
We want to achieve **Safe & Complete Error Transparency**.
All failures—whether from database integrity checks, Telegram MTProto session hangups, or AI limits—must propagate descriptive, exact messages and machine-readable error codes to the user interface, while safeguarding sensitive backend credentials or DB query outlines.

---

## 2. Current Architecture & Root Cause Analysis

### 2.1 The Backend Bottleneck: Global `errorHandler.ts`
As analyzed in `apps/api/src/middleware/errorHandler.ts`:
```typescript
export function errorHandler(
  error: Error & { statusCode?: number; code?: string; validation?: unknown[] },
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500
  const code = error.code ?? 'INTERNAL_ERROR'

  if (statusCode >= 500) {
    console.error('[API Error]', error)
  }

  const body: ApiError = {
    error: statusCode >= 500 ? 'Internal Server Error' : error.message, // <-- THE BOTTLENECK
    code,
    statusCode,
  }

  reply.status(statusCode).send(body)
}
```
* **Impact**: Any error thrown by a library (like Postgres-JS, Drizzle-ORM, Ioredis, or GramJS) does not carry an explicit `.statusCode` field. Therefore, it automatically triggers `statusCode = 500` and gets stripped of its exact `error.message`, sending the masked `"Internal Server Error"` to the user.

### 2.2 The Frontend Bottleneck: `api.ts`
As analyzed in `apps/web/src/lib/api.ts`:
```typescript
if (!res.ok) {
  const err = await res.json().catch(() => ({})) as { error?: string; code?: string }
  throw Object.assign(new Error(err.error ?? 'Request failed'), { code: err.code, statusCode: res.status }) // <-- THE FALLBACK
}
```
* **Impact**: If Nginx returns HTML (during a deployment or server crash) or if the backend sends an empty response, `res.json()` catches and falls back to a blank object, triggering the generic `"Request failed"` UI alert.

---

## 3. Subsystem Error Scan (Current vs. Proposed)

Below is an exhaustive scan of the entire codebase, identifying every critical point where errors can be thrown, their current masked status, and the proposed transparent error code mapping.

### 3.1 Authentication & Registration (`/v1/auth/*`)
Located in [auth.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/auth.ts).

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `auth.ts` / `/register` | User registers with an email that already exists. | `EMAIL_EXISTS` (handled) | `409 Conflict` (handled) | `409` "Email already registered" (`EMAIL_EXISTS`) |
| `auth.ts` / `/register` | User inputs invalid email format or password under 8 chars. | Zod Validation | `400` "Invalid input" | `400` "Invalid input: Email must be valid; Password must contain at least 8 characters" |
| `auth.ts` / `/login` | Password hashing mismatch / malformed stored hash. | `TypeError` in `timingSafeEqual` (fixed) | `500` "Internal Server Error" | `401` "Invalid credentials" (`INVALID_CREDENTIALS`) |
| `auth.ts` / `/refresh` | Redis connection drop while fetching token. | `ECONNREFUSED` or timeout | `500` "Internal Server Error" | `503` "Cache service temporarily offline. Please try again in a few seconds." (`CACHE_OFFLINE`) |

---

### 3.2 Telegram Service & MTProto Linking (`/v1/telegram/*`)
Located in [telegram.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/telegram.ts) and [telegram.ts (Service)](file:///home/sudo69/devops-core/televerse/apps/api/src/services/telegram.ts).

These are highly critical because Telegram throws very specific exceptions that users must respond to immediately.

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `telegram.ts` / `/step1` | Telegram API rate limits the number of phone OTP requests. | `FLOOD_WAIT_X` | `500` "Internal Server Error" | `429` "Telegram rate limit exceeded: Please wait X seconds before trying again." (`TG_FLOOD_WAIT`) |
| `telegram.ts` / `/step1` | The provided phone number is invalid or formatted incorrectly. | `PHONE_NUMBER_INVALID` | `500` "Internal Server Error" | `400` "The phone number entered is invalid. Please check your country code." (`TG_PHONE_INVALID`) |
| `telegram.ts` / `/step2` | User inputs an incorrect Telegram verification code. | `PHONE_CODE_INVALID` | `400` "The verification code is invalid" | `400` "The verification code entered is incorrect. Please try again." (`PHONE_CODE_INVALID`) |
| `telegram.ts` / `/step2` | Verification code expired during the login delay. | `PHONE_CODE_EXPIRED` | `400` "The verification code has expired" | `400` "Your verification code has expired. Please request a new code." (`PHONE_CODE_EXPIRED`) |
| `telegram.ts` / `/step2` | Account is password protected and 2FA password is required. | `TFA_REQUIRED` | `428` "Two-factor authentication required" | `428` "Two-factor authentication required" (`TFA_REQUIRED`) |
| `telegram.ts` / `/step2` | The 2FA password entered is incorrect. | `PASSWORD_HASH_INVALID` | `400` "The 2FA password is incorrect" | `401` "Incorrect 2FA password. Please check your password and try again." (`TG_2FA_INCORRECT`) |
| `telegram.ts` (All routes) | Decryption of user's session token fails (key change/corruption). | AES decryption fail | `500` "Internal Server Error" | `401` "Your Telegram session could not be decrypted. Please disconnect and reconnect your account." (`TG_SESSION_DECRYPT_FAILED`) |

---

### 3.3 Files Upload & Management (`/v1/files/*`)
Located in [files.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/files.ts) and [telegram.ts (Service)](file:///home/sudo69/devops-core/televerse/apps/api/src/services/telegram.ts).

This is where the user was previously experiencing `500 Internal Server Errors` when dragging/dropping files.

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `files.ts` / `/upload` | File exceeds maximum permitted server upload limit (2 GB). | Fastify multipart limit | `413 Payload Too Large` | `413` "File size exceeds the 2 GB limit." (`FILE_TOO_LARGE`) |
| `files.ts` / `/upload` | Server lacks space or disk write access in transient `/data`. | `ENOSPC` / `EACCES` | `500` "Internal Server Error" | `507` "Server storage volume is write-locked or full. Contact support." (`STORAGE_WRITE_ERROR`) |
| `telegram.ts` (upload) | Telegram blocks upload because of flooding/abuse limits. | `FLOOD_WAIT_X` | `500` "Internal Server Error" | `429` "Telegram upload speed-restricted. Please wait X seconds." (`TG_UPLOAD_FLOOD`) |
| `telegram.ts` (upload) | MTProto upload succeeds but we fail to extract the document message ID. | `Failed to get message ID...` | `500` "Internal Server Error" | `502` "Failed to register file ID from Telegram update stream." (`TG_MESSAGE_ID_NOT_FOUND`) |
| `files.ts` / `/download` | Telegram session has been revoked externally via the Telegram app. | `AUTH_KEY_UNREGISTERED` | `500` "Internal Server Error" | `401` "Your Telegram link has expired or was revoked. Please reconnect." (`TG_SESSION_EXPIRED`) |

---

### 3.4 Folders Hierarchy (`/v1/folders/*`)
Located in [folders.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/folders.ts).

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `folders.ts` / `/` (POST) | Creating a folder inside a parent that has reached depth 10. | `MAX_DEPTH` (handled) | `400` "Maximum folder depth (10) reached" | `400` "Cannot create nested folder: Maximum hierarchy depth limit (10) reached." (`FOLDER_MAX_DEPTH_REACHED`) |
| `folders.ts` / `/:id` | Folder delete request for folder that does not exist. | Empty result rows | `404` "Folder not found" | `404` "Target folder not found or already deleted." (`FOLDER_NOT_FOUND`) |
| `folders.ts` (All DB) | Recursive query stack depth exceeded or query locks. | Postgres stack depth | `500` "Internal Server Error" | `508` "Folder hierarchy loop detected or depth limit exceeded." (`FOLDER_HIERARCHY_LOOP`) |

---

### 3.5 Shared Links (`/v1/share/*`)
Located in [share.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/share.ts).

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `share.ts` / `/:token` | The download limit set by the link owner has been reached. | `DOWNLOAD_LIMIT` | `410` "Download limit reached" | `410` "This download link has reached its maximum permitted download limit." (`DOWNLOAD_LIMIT_REACHED`) |
| `share.ts` / `/:token` | The shared link's scheduled expiration date has passed. | `LINK_EXPIRED` | `410` "Link expired" | `410` "This shared link has expired and is no longer available." (`SHARE_LINK_EXPIRED`) |
| `share.ts` / `/:token/download` | Protected download link password is incorrect. | Password mismatch | `403` "Invalid password" | `403` "Incorrect password. Access denied." (`SHARE_PASSWORD_INVALID`) |
| `share.ts` / `/:token/download` | Owner's linked Telegram session is offline/revoked. | Missing session | `503` "File unavailable" | `503` "The owner's Telegram link is inactive. File temporarily offline." (`TG_OWNER_SESSION_OFFLINE`) |

---

### 3.6 AI & Semantic Search (`/v1/ai/*`)
Located in [ai.ts](file:///home/sudo69/devops-core/televerse/apps/api/src/routes/ai.ts) and [ai.ts (Service)](file:///home/sudo69/devops-core/televerse/apps/api/src/services/ai.ts).

| Target File & Code Location | Trigger Condition | Current Thrown Error | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- | :--- |
| `ai.ts` / `/chat` | Groq / OpenAI LLM API returns a rate limit block. | `RateLimitError` | `500` "Internal Server Error" | `429` "AI search / chat capacity limit exceeded. Please try again shortly." (`AI_RATE_LIMIT_EXCEEDED`) |
| `ai.ts` / `/chat` | Model requested is deprecated or server offline. | `APIConnectionError` | `500` "Internal Server Error" | `503` "AI intelligence service is temporarily unresponsive. Falling back." (`AI_SERVICE_UNAVAILABLE`) |
| `ai.ts` / `/semantic` | Database vector search fails due to schema or mismatch. | pgvector error | `500` "Internal Server Error" | `500` "Vector embeddings database query failed." (`VECTOR_QUERY_FAILED`) |

---

### 3.7 Core Infrastructure (Database & Redis)
Triggered globally during Drizzle database interactions or caching.

| Trigger Condition | Primary Error Thrower | Current Masked Response | Proposed Transparent Response |
| :--- | :--- | :--- | :--- |
| Postgres has shut down, rebooting, or hit max connection limit. | `postgres` connection pool | `500` "Internal Server Error" | `503` "Database connection failed. The server might be restarting. Please retry in 10 seconds." (`DB_CONNECTION_FAILED`) |
| Unique constraint or foreign key index violation occurs. | `drizzle-orm` constraint | `500` "Internal Server Error" | `409` "Data integrity conflict: Referenced resource is unavailable or duplicated." (`DATABASE_INTEGRITY_CONFLICT`) |
| Redis caching instance falls over or reboots. | `ioredis` Client | `500` "Internal Server Error" | `503` "Caching server offline. Restoring states..." (`CACHE_SERVICE_FAILURE`) |

---

## 4. Proposed Error Classification Architecture

To implement this plan without littering individual endpoint routes with bulky `try-catch` blocks, we propose a unified **Custom Error Hierarchy** combined with a robust **Error Transformer Engine** in the Fastify middleware.

### 4.1 Custom Error Classes
We will introduce standard Error classes inheriting from `Error`, allowing developers to throw exact issues with built-in metadata:

```typescript
// packages/types/src/errors.ts or similar shared space
export class TeleVerseError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly data?: any;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', data?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Subclasses for specific domains:
export class TelegramError extends TeleVerseError {
  constructor(message: string, statusCode: number = 400, code: string = 'TG_ERROR', data?: any) {
    super(message, statusCode, code, data);
  }
}

export class DatabaseError extends TeleVerseError {
  constructor(message: string, statusCode: number = 503, code: string = 'DB_ERROR') {
    super(message, statusCode, code);
  }
}
```

### 4.2 Proactive Error Mapping Registry
In `apps/api/src/middleware/errorHandler.ts`, we will construct a map to intercept third-party failures (from Telegram/GramJS, Postgres, Drizzle, Redis, or Groq) and transform them dynamically before replying:

```typescript
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiError } from '@televerse/types'

export function errorHandler(
  error: Error & { statusCode?: number; code?: string; data?: any },
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  let statusCode = error.statusCode ?? 500
  let code = error.code ?? 'INTERNAL_ERROR'
  let message = error.message

  // 1. Map third-party GramJS errors
  if (error.name === 'RPCError' || error.message.includes('RPCError') || error.code === 'FLOOD_WAIT') {
    statusCode = 429
    code = 'TG_FLOOD_WAIT'
    const waitSeconds = error.message.match(/\d+/)?.[0] ?? 'some'
    message = `Telegram rate limit hit. Please wait ${waitSeconds} seconds before trying again.`
  } else if (error.message.includes('AUTH_KEY_UNREGISTERED') || error.message.includes('SESSION_REVOKED')) {
    statusCode = 401
    code = 'TG_SESSION_EXPIRED'
    message = 'Your Telegram account connection has expired. Please link your phone again under settings.'
  } else if (error.message.includes('PHONE_CODE_INVALID')) {
    statusCode = 400
    code = 'TG_PHONE_CODE_INVALID'
    message = 'The verification code you entered is invalid. Please check and try again.'
  }
  
  // 2. Map Database Driver Failures
  else if (error.message.includes('connect ECONNREFUSED') && error.message.includes('5432')) {
    statusCode = 503
    code = 'DB_CONNECTION_FAILED'
    message = 'The main database is currently offline or restarting. Your data is safe. Please retry shortly.'
  }
  
  // 3. Map Redis Failures
  else if (error.message.includes('connect ECONNREFUSED') && error.message.includes('6379')) {
    statusCode = 503
    code = 'CACHE_SERVICE_FAILURE'
    message = 'The cache network is offline. Re-establishing connection...'
  }

  // Log 5xx errors internally for developer debugging
  if (statusCode >= 500) {
    console.error('[CRITICAL API ERROR]:', error)
  }

  // Return clean, informative JSON response to the user
  const body: ApiError = {
    error: message, // <-- ALWAYS transparently passes the custom/mapped error message
    code,
    statusCode,
    ...(error.data ? { data: error.data } : {})
  }

  reply.status(statusCode).send(body)
}
```

---

## 5. Frontend Integration & Actionable UI Alerts

Exposing descriptive errors from the backend is only half the battle. The React Frontend must display these precise errors to the user in a beautiful, actionable layout rather than hiding them.

### 5.1 Enhanced Request Utility
In `apps/web/src/lib/api.ts`, we will improve error resolution:
```typescript
if (!res.ok) {
  const err = await res.json().catch(() => ({})) as { error?: string; code?: string }
  
  // If the server returned a structured error message, forward it directly.
  // Otherwise, fallback to a meaningful browser status code alert.
  const descriptiveMessage = err.error ?? `Server error (${res.status}): Please check your connection.`
  
  throw Object.assign(new Error(descriptiveMessage), { 
    code: err.code ?? 'UNKNOWN_ERROR', 
    statusCode: res.status 
  })
}
```

### 5.2 Toast Notification & Guide Integration
When the frontend catches these custom errors, we will intercept specific `code` attributes and prompt the user with clear instructions inside modern UI notifications (e.g. `hot-toast` or custom modal components):

```typescript
try {
  await api.upload('/v1/files/upload', formData);
} catch (err: any) {
  switch (err.code) {
    case 'TG_SESSION_EXPIRED':
      toast.error('Telegram disconnected!', {
        description: 'Your Telegram linking session has expired. Click here to go to settings and reconnect.',
        action: {
          label: 'Reconnect',
          onClick: () => router.push('/drive/settings')
        }
      });
      break;
    case 'TG_FLOOD_WAIT':
      toast.error('Upload Rate Limited', {
        description: err.message || 'Please wait a short while before uploading more files.'
      });
      break;
    case 'DB_CONNECTION_FAILED':
      toast.error('Database is updating', {
        description: 'We are currently experiencing database lag. Please do not refresh; retrying automatically.'
      });
      break;
    default:
      toast.error('Upload Failed', {
        description: err.message || 'An unexpected error occurred.'
      });
  }
}
```

---

## 6. Implementation Checklist & Verification

To execute the Error Transparency Upgrade (Phase 1.2), the following steps should be completed:

- [ ] Create Custom Exception types in `packages/types/src/errors.ts`.
- [ ] Upgrade Fastify global `errorHandler.ts` to include the robust mapping rules for GramJS, Drizzle/Postgres, Redis, and AI endpoints.
- [ ] Modify the Next.js API client (`api.ts`) to resolve and throw exact backend error string payloads.
- [ ] Set up comprehensive testing mocks inside `api.test.ts` to ensure that simulated 3rd-party exceptions return exact messages and HTTP status codes (e.g., mock a `FLOOD_WAIT` RPC exception and verify it returns code `429` and the mapped message).
- [ ] Deploy the updates live, and perform manual browser verification to verify that error screens display actionable steps.
