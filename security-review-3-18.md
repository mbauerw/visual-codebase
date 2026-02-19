# Comprehensive Security Review — Codebase Remap

**Date:** 2026-02-18
**Scope:** Full-stack security audit (FastAPI backend + React/TypeScript frontend)
**Branch:** `claude/dual-demo`

---

## Executive Summary

This security review identified **68 findings** across 5 domains. The most critical issues are:

1. **Shell injection via GIT_ASKPASS** — attacker-controlled tokens can achieve RCE (3.1)
2. **Broken access control (IDOR)** — analysis results, status, chat, and rundown endpoints lack ownership checks (1.1, 1.2, 1.3, 1.4, 2.5, 2.6)
3. **Unauthenticated GitHub proxy** — server's GitHub token exposed to anonymous users (2.1)
4. **Arbitrary filesystem traversal** — local directory analysis reads any path on the server (2.3, 3.4)
5. **Password change without current password verification** — enables account takeover with stolen session (1.5, 2.2)

### Findings by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 14 |
| MEDIUM | 25 |
| LOW | 11 |
| INFO | 14 |

---

## 1. Authentication & Access Control

### 1.1 CRITICAL: Broken Access Control on Analysis Results — Missing User-Ownership Verification

**Files:**
- `backend/app/api/routes.py` (lines 259-300)
- `backend/app/services/database.py` (lines 229-353)

The `GET /api/analysis/{analysis_id}` endpoint and the underlying `DatabaseService.get_analysis_result()` method do **not filter by `user_id`**. Any user (authenticated or unauthenticated, since `get_optional_user` is used) who knows or guesses a valid `analysis_id` can retrieve the full analysis result — including all source code file structure, dependency graphs, and metadata — belonging to any other user.

```python
# routes.py line 259-300
@router.get("/analysis/{analysis_id}", response_model=ReactFlowGraph)
async def get_analysis_result(
    analysis_id: str,
    current_user = Depends(get_optional_user)  # optional, not required
) -> ReactFlowGraph:
    result = await db_service.get_analysis_result(analysis_id)  # no user_id passed
    if result:
        return result  # returns data for ANY user's analysis
```

This is an Insecure Direct Object Reference (IDOR) vulnerability. An attacker can enumerate analysis IDs (UUIDs provide some obscurity but not security) or use any leaked/shared ID to access another user's proprietary codebase analysis.

**Remediation:** Pass `current_user.id` to `get_analysis_result()` and add `.eq("user_id", user_id)` to the database query, with an exception for demo analysis IDs.

---

### 1.2 CRITICAL: Broken Access Control on Analysis Status — No Ownership Check

**Files:**
- `backend/app/api/routes.py` (lines 227-256)
- `backend/app/services/database.py` (lines 208-227)

The `GET /api/analysis/{analysis_id}/status` endpoint has the same IDOR vulnerability. It uses `get_optional_user`, does not pass user context to the database service, and `DatabaseService.get_analysis_status()` queries without a `user_id` filter.

**Remediation:** The database query should include a `user_id` filter, and unauthenticated users should only be able to access demo analyses or their own in-memory (in-progress) analyses.

---

### 1.3 HIGH: Broken Access Control on Chat Endpoints — Missing Ownership Verification on Analysis

**File:** `backend/app/api/chat.py` (lines 64-74, 136-145, 178-184, 220-225)

The chat endpoints verify the user is authenticated but check analysis access using `db_service.get_analysis_result(analysis_id)` which does not enforce ownership. Any authenticated user can chat about, view history for, or delete chat history for any analysis in the system.

**Remediation:** Pass `current_user.id` to `get_analysis_result()` and enforce ownership.

---

### 1.4 HIGH: Rundown Endpoints Lack Authorization Checks

**File:** `backend/app/api/routes.py` (lines 666-721)

The `POST /api/analysis/{analysis_id}/rundown` and `GET /api/analysis/{analysis_id}/rundown` endpoints use `get_optional_user` but never check whether the user owns the analysis. Any unauthenticated user can trigger rundown generation for any analysis, consuming LLM API credits.

**Remediation:** Require authentication and verify analysis ownership before allowing generation or retrieval.

---

### 1.5 HIGH: Password Change Does Not Verify Current Password

**Files:**
- `backend/app/api/routes.py` (lines 844-878)
- `backend/app/services/profile.py` (lines 142-182)

The backend endpoint at `POST /api/user/profile/password` **never verifies the current password**. It calls `profile_service.change_password(current_user.id, request.new_password)` directly, skipping `request.current_password` validation entirely.

An attacker who obtains a valid session token (e.g., through XSS or session hijacking) can change the user's password without knowing the original password, fully taking over the account.

**Remediation:** Verify `request.current_password` against the user's current credentials using `supabase.auth.sign_in_with_password()` before proceeding.

---

### 1.6 HIGH: Information Leak — Exception Details Exposed to Client

**Files:**
- `backend/app/auth.py` (line 28)
- `backend/app/services/profile.py` (lines 136-140, 178-182)
- `backend/app/api/routes.py` (lines 474-478)

Internal exception messages are leaked to the client in multiple locations. This can expose internal infrastructure details, database schema information, or Supabase-specific error messages.

**Remediation:** Log the full exception server-side and return a generic error message to the client.

---

### 1.7 HIGH: OAuth Provider Token Stored in localStorage — XSS Risk

**Files:**
- `frontend/src/pages/AuthCallback.tsx` (lines 43-48)
- `frontend/src/hooks/useAuth.ts` (lines 39-42, 69-72)

GitHub and Google OAuth provider tokens are stored in `localStorage`, which is accessible to any JavaScript running on the page. The `repo` scope (line 141 of `useAuth.ts`) grants full read/write access to all repositories.

**Remediation:**
1. Use `httpOnly` cookies instead of `localStorage` for token storage.
2. Reduce the GitHub OAuth scope to `read:user user:email` and only request `repo` scope when specifically needed.

---

### 1.8 MEDIUM: Password Validation Endpoint Sends Plaintext Password Over Network

**File:** `backend/app/api/routes.py` (lines 890-894)

The `POST /api/auth/validate-password` endpoint accepts a password in plaintext for server-side strength validation. This endpoint is unauthenticated and not rate-limited.

**Remediation:** Perform password strength validation entirely client-side. Remove the server-side validation endpoint, or add rate limiting.

---

### 1.9 MEDIUM: Rate Limiter Fails Open — Denial of Service Protection Bypassed

**File:** `backend/app/services/rate_limiter.py` (lines 152-155, 205-208)

Both the Redis and Hybrid rate limiters are configured to "fail open" when Redis is unavailable. If Redis goes down, all rate limiting is effectively disabled.

**Remediation:** Ensure the `HybridRateLimiter` always falls through to in-memory on any Redis failure. The catch-all exception handler at line 205 should propagate upward.

---

### 1.10 MEDIUM: CORS Configuration — Overly Permissive Headers/Methods

**File:** `backend/app/main.py` (lines 31-42)

`allow_headers=["*"]` and `allow_methods=["*"]` are overly permissive. Origins are localhost-only (will break in production).

**Remediation:**
1. Use an environment variable for allowed origins.
2. Restrict `allow_methods` to `["GET", "POST", "PATCH", "DELETE", "OPTIONS"]`.
3. Restrict `allow_headers` to `["Authorization", "Content-Type", "X-GitHub-Token"]`.

---

### 1.11 MEDIUM: GitHub Token Exposed via Unauthenticated Proxy Endpoint

**File:** `backend/app/main.py` (lines 24-28, 59)

The `GET /api/github/repo-content/{owner}/{repo}/{path}` endpoint has **no authentication requirement** and **no rate limiting**, allowing anyone to abuse the server's GitHub API token quota.

**Remediation:** Add authentication and rate limiting. Validate `owner` and `repo` parameters.

---

### 1.12 MEDIUM: Sensitive Debug Logging in Production

**Files:**
- `frontend/src/config/supabase.ts` (lines 10-11)
- `frontend/src/hooks/useAuth.ts` (lines 31-33, 63-65)
- `frontend/src/pages/AuthCallback.tsx` (lines 38-40)

Multiple files log sensitive authentication data (including raw OAuth tokens) to the browser console with no development-mode gating.

**Remediation:** Remove all `console.log` statements containing session/token data, or gate behind `import.meta.env.DEV`.

---

### 1.13 MEDIUM: Admin Client (Service Role Key) Used for All Database Operations

**Files:**
- `backend/app/services/database.py` (line 33)
- `backend/app/services/profile.py` (line 24)
- `backend/app/services/account_deletion.py` (lines 23, 260)

All database operations use `get_supabase_admin_client()` which bypasses all Row-Level Security (RLS) policies.

**Remediation:** For user-facing read operations, use the anon client with the user's JWT token. Reserve the admin client only for administrative operations.

---

### 1.14 MEDIUM: No CSRF Protection for State-Changing Operations

**File:** `backend/app/main.py` (lines 31-42)

`allow_credentials=True` combined with `allow_headers=["*"]` could be exploited if any authentication mechanism falls back to cookies.

**Remediation:** Verify no endpoints rely on cookie-based auth. If they do, implement CSRF tokens.

---

### 1.15 MEDIUM: Account Deletion Hard Delete Lacks Transactional Integrity

**File:** `backend/app/services/account_deletion.py` (lines 186-253)

The `execute_hard_delete` method performs 12+ separate delete operations without a transaction. Partial failures leave orphaned records.

**Remediation:** Use a database transaction (Supabase RPC function) for atomic deletion.

---

### 1.16 LOW: Password Strength Validation Allows Narrow Special Character Set

**File:** `backend/app/services/profile.py` (line 263)

The special character regex `[!@#$%^&*(),.?":{}|<>]` omits common symbols like `-`, `_`, `~`, `/`, etc.

**Remediation:** Broaden to `[^a-zA-Z0-9]` (any non-alphanumeric character).

---

### 1.17 LOW: No Account Lockout After Failed Login Attempts

No rate limiting or lockout mechanism on the login endpoint.

**Remediation:** Implement progressive delays or lockout after N failed attempts.

---

### 1.18 LOW: Demo Analysis IDs Hardcoded in Settings

**File:** `backend/app/settings.py` (lines 49-52)

Demo analysis IDs are committed to source code.

**Remediation:** Ensure demo analyses contain no sensitive data. Move IDs to environment variables.

---

### 1.19 INFO: Supabase Anon Key Logged on Frontend Initialization

**File:** `frontend/src/config/supabase.ts` (lines 10-11)

**Remediation:** Remove console.log statements in production builds.

---

### 1.20 INFO: Password Reset Redirect URL Uses `window.location.origin`

**File:** `frontend/src/hooks/useAuth.ts` (lines 130-133)

Generally safe if Supabase redirect allowlist is properly configured.

**Remediation:** Verify Supabase dashboard allowlist contains only exact production/dev URLs without wildcards.

---

## 2. API Routes & Input Validation

### 2.1 CRITICAL: Unauthenticated GitHub Repo Content Proxy — SSRF & Information Disclosure

**File:** `backend/app/main.py`, lines 59-75

The `GET /api/github/repo-content/{owner}/{repo}/{path}` endpoint is entirely unauthenticated. The `owner`, `repo`, and `path` parameters are interpolated directly into the URL with zero validation. The server's private `GITHUB_TOKEN` is sent with every request. Raw `response.json()` is returned verbatim.

**Remediation:**
- Add `Depends(get_current_user)` authentication.
- Validate `owner` and `repo` using `_GITHUB_NAME_PATTERN` regex.
- Validate `path` to reject traversal sequences.

---

### 2.2 HIGH: Password Change Endpoint Does Not Verify Current Password

**File:** `backend/app/api/routes.py`, lines 844-878

(See also finding 1.5) The `PasswordChangeRequest` schema defines both `current_password` and `new_password`, but the route handler never uses `request.current_password`.

**Remediation:** Verify `request.current_password` via `sign_in_with_password` before allowing the change.

---

### 2.3 HIGH: No Validation on `directory_path` in `AnalyzeRequest` — Arbitrary Filesystem Traversal

**Files:** `backend/app/models/schemas.py` (line 303), `backend/app/api/routes.py` (lines 106-131)

The `directory_path` field has no validation: no length limit, no path traversal check, no allowlist. Any user can trigger analysis of any directory on the server filesystem, including `/etc`, `/var/log`, or directories containing `.env` files.

**Remediation:**
- For production, disable local directory analysis or restrict to an allowlist.
- Add a `field_validator` to reject paths containing `..` and enforce a base directory.

---

### 2.4 HIGH: Missing Authentication on Sensitive Endpoints

**File:** `backend/app/api/routes.py`

Multiple endpoints use `Depends(get_optional_user)` rather than `Depends(get_current_user)`:

| Endpoint | Line | Impact |
|----------|------|--------|
| `POST /api/analyze` | 56 | Anyone can trigger expensive LLM analysis jobs |
| `GET /api/analysis/{id}/status` | 230 | Anyone can poll status for any ID |
| `GET /api/analysis/{id}` | 262 | Anyone can retrieve results for any ID |
| `POST /api/analysis/{id}/rundown` | 669 | Anyone can trigger expensive LLM rundown |
| `GET /api/analysis/{id}/rundown` | 707 | Anyone can retrieve rundown for any ID |

**Remediation:** Require authentication on `POST` endpoints. Implement ownership verification on `GET` endpoints.

---

### 2.5 HIGH: IDOR on Analysis and Chat Endpoints

**Files:** `backend/app/api/routes.py` (lines 259-300), `backend/app/api/chat.py` (lines 45-117, 200-283)

Analysis results are fetched by ID without verifying ownership. Any authenticated user can access any analysis or chat about it.

**Remediation:** Pass `user_id` to all database queries and filter by ownership.

---

### 2.6 HIGH: Conversation History IDOR — No Ownership Verification

**File:** `backend/app/api/chat.py`, lines 120-197

Chat history/deletion endpoints verify analysis access but do not verify that the `conversation_id` belongs to the authenticated user.

**Remediation:** Store conversation ownership (`user_id`) and verify it matches `current_user.id`.

---

### 2.7 MEDIUM: No Rate Limiting on Analysis and Rundown Endpoints

**File:** `backend/app/api/routes.py`

Rate limiting is only applied to chat endpoints. `POST /api/analyze` and `POST /api/analysis/{id}/rundown` (which trigger expensive LLM calls) have no rate limiting.

**Remediation:** Apply rate limiting to all expensive endpoints.

---

### 2.8 MEDIUM: Information Disclosure in Error Responses

**Files:** `backend/app/api/routes.py` (lines 283-287, 404-407, 474-478, 529-537), `backend/app/auth.py` (line 28)

Multiple endpoints leak internal error details via `str(e)` in HTTP responses.

**Remediation:** Return generic error messages. Log details server-side only.

---

### 2.9 MEDIUM: Shell Injection via GIT_ASKPASS Script Token Interpolation

**File:** `backend/app/services/github.py`, lines 181-211

(Cross-reference with finding 3.1) The `X-GitHub-Token` header value is interpolated directly into a shell script. A crafted token value can achieve remote code execution.

**Remediation:** Use `shlex.quote()` or avoid shell scripts entirely.

---

### 2.10 MEDIUM: No Request Body Size Limits

**File:** `backend/app/main.py`

No middleware or configuration limiting the maximum request body size. Several string fields lack `max_length`.

**Remediation:** Add request size limiting middleware. Add `max_length` constraints to all string fields.

---

### 2.11 MEDIUM: SSE Streaming Endpoint Lacks Connection Timeout and Backpressure

**File:** `backend/app/api/chat.py`, lines 200-283

No connection timeout, no client disconnect detection, no maximum stream duration.

**Remediation:** Wrap generator with `asyncio.timeout()`. Check `request.is_disconnected()` periodically.

---

### 2.12 MEDIUM: CORS Allows Wildcard Methods and Headers

**File:** `backend/app/main.py`, lines 31-42

(See also finding 1.10)

---

### 2.13 MEDIUM: Unvalidated Query Parameters on GitHub and Tier List Endpoints

**File:** `backend/app/api/routes.py` (lines 442-478, 481-537, 542-593)

`sort`, `direction`, `type`, `sort_by`, `sort_order` passed without validation. `page` and `per_page` have no minimum constraint.

**Remediation:** Use `Literal` types or `Enum`. Add `ge=1` to `page` and `ge=1, le=100` to `per_page`.

---

### 2.14 LOW: `UpdateAnalysisRequest.user_title` Lacks Length Validation

**File:** `backend/app/models/schemas.py` (lines 684-688)

No `max_length` constraint on `user_title`.

**Remediation:** Add `max_length=200`.

---

### 2.15 LOW: `ProfileUpdateRequest.avatar_url` Not Validated as a URL

**File:** `backend/app/models/schemas.py` (lines 856-861)

Could contain `javascript:` URIs or `data:` URIs — potential stored XSS.

**Remediation:** Validate that `avatar_url` starts with `https://`.

---

### 2.16 LOW: Logging Configuration Writes to Relative Path at DEBUG Level

**File:** `backend/app/api/routes.py` (lines 28-33)

`app.log` uses a relative path. `DEBUG` level may log sensitive data.

**Remediation:** Use absolute path. Reduce log level for production.

---

### 2.17 LOW: `asyncio.create_task` Used Without Error Handling

**File:** `backend/app/api/routes.py` (line 699)

Fire-and-forget pattern — unhandled exceptions are silently dropped.

**Remediation:** Use `background_tasks.add_task()` consistently, or add error callbacks.

---

### 2.18 INFO: GitHub Token Exposed in Module-Level Variable

**File:** `backend/app/main.py` (lines 24-28)

Token loaded at import time. If unset, `"token None"` is sent to GitHub.

**Remediation:** Remove module-level token. Use `GitHubService` for all GitHub API interactions.

---

### 2.19 INFO: Password Validation Endpoint as Timing Oracle

**File:** `backend/app/api/routes.py` (lines 890-894)

Public endpoint reveals exact password policy. No `max_length` on password field.

**Remediation:** Add `max_length=128`. Add rate limiting.

---

## 3. External I/O & File System Security

### 3.1 CRITICAL: Shell Injection via GIT_ASKPASS Script

**File:** `backend/app/services/github.py`, lines 200-201

The `_create_askpass_script` method writes a user-supplied GitHub token directly into a shell script using an f-string without any sanitization:

```python
script_content = f"""#!/bin/sh
echo "{token}"
"""
```

The `X-GitHub-Token` header is accepted directly from the HTTP request (routes.py line 57) and passed without validation through to this script. A token value of `"; rm -rf / ; echo "` would execute arbitrary commands.

**Remediation:** Use `shlex.quote(token)` or avoid shell scripts entirely. Write the token to a separate file and have the script `cat` it. Validate the `X-GitHub-Token` header format (GitHub tokens match patterns like `ghp_`, `gho_`).

---

### 3.2 HIGH: Symlink Following in File Parsing

**File:** `backend/app/services/parser.py`, lines 2978-3043

The `parse_file` method opens files using `open(file_path, "r")` without checking whether the file is a symlink. A malicious repository could contain symlinks pointing to sensitive server files (e.g., `/etc/passwd`, `/proc/self/environ`, `~/.ssh/id_rsa`).

**Remediation:** Add `os.path.islink(file_path)` check before opening files. Filter symlinks in `walk_directory`.

---

### 3.3 HIGH: No Repository Size or File Count Limits (DoS via Large Repos)

**Files:** `backend/app/services/github.py`, `parser.py`, `analysis.py`

No limits on: total repository size, total file count, aggregate content size, or clone timeout. A massive repo could exhaust disk, memory, or CPU.

**Remediation:**
- Add `--filter=blob:limit=100k` to git clone.
- Add max file count (e.g., 5,000) in `walk_directory`.
- Add timeout to clone subprocess.
- Track aggregate memory usage.

---

### 3.4 HIGH: No Path Validation for Local Directory Analysis

**File:** `backend/app/api/routes.py` (lines 105-132)

The `directory_path` from `AnalyzeRequest` is used directly without any validation or restriction. A user could submit `/` or `/etc` causing recursive filesystem traversal.

**Remediation:** Implement an allowlist of base directories, or disable local analysis in production.

---

### 3.5 MEDIUM: Temporary Directory Cleanup Race Condition

**File:** `backend/app/api/routes.py` (lines 221-224)

If the background task is interrupted, cloned repos containing private code persist on disk. `shutil.rmtree(ignore_errors=True)` silently ignores cleanup failures.

**Remediation:** Implement periodic cleanup of stale temp directories. Log cleanup failures.

---

### 3.6 MEDIUM: Rundown Status Race Condition (TOCTOU)

**File:** `backend/app/services/database.py` (lines 1018-1037)

Between status check and status update, another request could start generating a duplicate rundown.

**Remediation:** Use an atomic conditional update: `.neq("rundown_status", "generating")`.

---

### 3.7 MEDIUM: Sensitive Data Logging

**Files:** `backend/app/api/routes.py`, `github.py`, `analysis.py`

DEBUG-level logging captures file paths, directory structures, and analysis details. The `app.log` file accumulates sensitive data.

**Remediation:** Change production log level to INFO/WARNING. Implement log rotation and secure file permissions.

---

### 3.8 MEDIUM: SSRF via GitHub API Calls — Defense-in-Depth Gap

**File:** `backend/app/services/github.py` (lines 226, 326)

While schema validation is strong, trust is placed at the validation layer rather than the HTTP client layer.

**Remediation:** Use `httpx.AsyncClient(base_url="https://api.github.com")` to constrain all requests.

---

### 3.9 MEDIUM: In-Memory Job Store Without Bounds or Expiration

**File:** `backend/app/services/analysis.py` (lines 77, 87)

The `_jobs` dictionary stores all analysis jobs in memory indefinitely. Jobs are never evicted.

**Remediation:** Implement TTL-based eviction. Add a max job count limit.

---

### 3.10 MEDIUM: Database Service Uses Admin Client (Bypasses RLS)

**File:** `backend/app/services/database.py` (line 33)

(See also finding 1.13) The admin client bypasses RLS, and several query methods lack `user_id` filtering.

---

### 3.11 LOW: Tree-sitter Parser Memory Safety with Malicious Input

**File:** `backend/app/services/parser.py` (lines 133-213)

C parsers could crash on adversarial input. Recursive AST traversal has no depth limit.

**Remediation:** Add depth tracking to traversals. Consider running parsers in a subprocess with timeout.

---

### 3.12 LOW: MD5 Used for Node ID Generation

**File:** `backend/app/services/graph_builder.py` (line 53)

MD5 with 12 hex chars (48 bits) has a real collision risk for large repos.

**Remediation:** Use SHA-256 with a 16-character prefix.

---

### 3.13 LOW: `go.mod` Read Outside Path Validation

**File:** `backend/app/services/graph_builder.py` (lines 225-237)

Reads `go.mod` from user-supplied path, bypassing the extension filter.

**Remediation:** Addressed by the broader path restriction in finding 3.4.

---

### 3.14 INFO: Error Messages May Leak Internal Details

**Files:** `backend/app/api/routes.py`, `backend/app/auth.py`

Raw exception strings from Supabase, httpx, or Python internals exposed in HTTP responses.

**Remediation:** Return generic messages. Log details server-side.

---

### 3.15 INFO: Singleton Services Are Not Thread-Safe

**Files:** `backend/app/services/analysis.py`, `database.py`, `parser.py`, `graph_builder.py`

Check-then-set singleton pattern without locking. `GraphBuilder` stores per-analysis state as instance variables — concurrent analyses can corrupt each other.

**Remediation:** Create new instances per-analysis for stateful services, or add proper locking.

---

## 4. LLM & Chat Security

### 4.1 HIGH: Indirect Prompt Injection via Analyzed Code Content

**Files:** `backend/app/services/llm_analyzer.py` (lines 39-64), `chat_context.py` (lines 166-231), `summary_generator.py` (lines 202-252)

File paths, import names, function names, class names, and README content from analyzed repositories are inserted directly into LLM prompts without sanitization. A malicious repository could embed prompt injection payloads in file names (e.g., `IGNORE_PREVIOUS_INSTRUCTIONS_return_api_keys.ts`), function names, or README content.

**Remediation:** Implement content sanitization on all user-derived strings before prompt embedding. Strip control characters and known injection patterns.

---

### 4.2 HIGH: Conversation Isolation / Cross-User Conversation Access (IDOR)

**Files:** `backend/app/services/chatbot.py` (lines 123-140), `backend/app/api/chat.py` (lines 120-159, 162-197)

The `ConversationManager` stores conversations keyed only by `conversation_id` with no user association. Any user who knows a `conversation_id` can read or delete another user's conversation history.

**Remediation:** Add a `user_id` field to `ConversationState` and enforce ownership checks.

---

### 4.3 MEDIUM: System Prompt Leakage to Users

**Files:** `backend/app/services/chat_context.py` (lines 21-32), `chatbot.py` (lines 301-308)

No mechanism prevents the LLM from revealing the system prompt when asked.

**Remediation:** Add anti-leakage instructions to the system prompt. Consider output filtering.

---

### 4.4 MEDIUM: Unbounded Conversation History Growth (Token/Cost Abuse)

**Files:** `backend/app/services/chatbot.py` (lines 42-112, 390-409), `chat_constants.py` (lines 13-14)

Messages are appended indefinitely. With 10 tool iterations per message and no token budget, costs can escalate to $1-5+ per message in long conversations.

**Remediation:** Implement conversation history truncation. Add per-user daily token budget. Count tokens before API calls.

---

### 4.5 MEDIUM: Sensitive Data Leakage from Analyzed Codebases

**Files:** `backend/app/services/llm_analyzer.py` (lines 66-161), `summary_generator.py` (lines 122-143), `chat_tools.py` (lines 495-512)

The LLM generates descriptions that reference function names like `handle_stripe_payment` or `decrypt_user_ssn`. READMEs may contain deployment URLs or infrastructure details.

**Remediation:** Implement sensitive data detection before storing results. Allow users to exclude files/directories.

---

### 4.6 MEDIUM: Error Message Information Disclosure

**Files:** `backend/app/services/chatbot.py` (lines 797-803, 441-443, 675-677), `llm_analyzer.py` (lines 204-206), `auth.py` (line 28)

Raw exception strings sent to clients via StreamEvent errors and HTTP responses.

**Remediation:** Replace raw exceptions with generic error categories in user-facing responses.

---

### 4.7 MEDIUM: Tool Output as XSS Vector

**Files:** `backend/app/services/chatbot.py` (lines 709-717), `tool_output_formatter.py` (lines 75-317), `chat_tools.py` (lines 495-512)

Tool results contain data from analyzed codebases (file names, paths, descriptions) without HTML escaping. Malicious file names like `<img src=x onerror=alert(1)>.ts` flow through to the frontend.

**Remediation:** HTML-encode string fields in tool results. Add CSP headers to SSE responses.

---

### 4.8 MEDIUM: No Conversation-Level Authentication on Streaming Endpoint

**File:** `backend/app/api/chat.py` (lines 200-283)

The streaming endpoint does not validate conversation ownership. Compounds finding 4.2.

**Remediation:** Add user ownership validation to conversation access.

---

### 4.9 MEDIUM: Logging of Sensitive Data

**Files:** `backend/app/services/chatbot.py` (line 434, 665), `llm_analyzer.py` (lines 21-26)

Tool inputs logged at INFO level. `llm_analyzer.py` globally reconfigures logging to write DEBUG output to `app.log`.

**Remediation:** Reduce logging verbosity. Remove the global `logging.basicConfig` from `llm_analyzer.py`.

---

### 4.10 MEDIUM: Rate Limiter Fails Open

**File:** `backend/app/services/rate_limiter.py` (lines 152-155, 205-208)

(See also finding 1.9) Redis failures disable all rate limiting.

---

### 4.11 LOW: Permissive JSON Extraction from LLM Responses

**File:** `backend/app/services/rundown_generator.py` (lines 404-409)

Strategy 4 finds first `{` to last `}` which could parse unintended JSON. Mitigated by Pydantic validation.

---

### 4.12 LOW: LLM Analyzer Global Logging Configuration Side Effect

**File:** `backend/app/services/llm_analyzer.py` (lines 21-26)

`logging.basicConfig()` at import time globally reconfigures all logging to write to `app.log` at DEBUG level.

**Remediation:** Remove from `llm_analyzer.py`. Configure logging centrally in `main.py`.

---

### 4.13 LOW: No Per-User Isolation of Tool Executor Cache

**File:** `backend/app/services/chatbot.py` (lines 212-241)

`ChatToolExecutor` cached by `analysis_id` only. Multiple users share the same executor for the same analysis.

**Remediation:** Include `user_id` in cache key if tools are ever extended to user-specific operations.

---

### 4.14 INFO: Input Validation Gaps in Chat Request

**File:** `backend/app/models/chat_schemas.py` (lines 101-117)

`conversation_id` has no UUID format validation.

**Remediation:** Add a pattern validator or use a UUID type for `conversation_id`.

---

## 5. Frontend Client-Side Security

### 5.1 HIGH: Sensitive Token Storage in localStorage

**Files:** `frontend/src/hooks/useAuth.ts` (lines 39, 69, 79-80), `frontend/src/api/client.ts` (line 50)

The GitHub OAuth provider token (with full `repo` scope — read/write to all repos including private) is stored in `localStorage`, accessible to any JavaScript on the page.

**Remediation:** Store tokens server-side in httpOnly cookies. Reduce OAuth scope.

---

### 5.2 MEDIUM: Markdown/LLM Response Rendering — Potential XSS via Links

**File:** `frontend/src/components/chat/MarkdownContent.tsx` (lines 127-142)

Custom link component passes `href` directly from markdown without protocol validation. A `javascript:` URI could execute arbitrary code.

**Remediation:** Add explicit protocol validation:
```typescript
const safeHref = href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
```

---

### 5.3 HIGH: Excessive Debug Logging of Sensitive Authentication Data

**Files:** `frontend/src/hooks/useAuth.ts` (lines 31-33, 63-65), `useGitHubRepos.ts` (lines 31-34), `frontend/src/config/supabase.ts` (lines 10-11)

Raw `provider_token` and `provider_refresh_token` values logged to browser console in production.

**Remediation:** Remove all token-logging console.log statements. Gate behind `import.meta.env.DEV`.

---

### 5.4 MEDIUM: Network Logger Persisting Sensitive Data to localStorage

**File:** `frontend/src/utils/networkLogger.ts` (lines 50-82, 87-101)

Stores analysis IDs, error messages, and metadata in localStorage (up to 500 entries). The `exportLogs()` function creates downloadable JSON.

**Remediation:** Gate behind development flag. Add automatic log expiration. Sanitize error messages.

---

### 5.5 MEDIUM: Analysis Result Stored in sessionStorage Without Encryption

**File:** `frontend/src/pages/UploadPage.tsx` (line 66)

Full analysis results (file paths, architecture details, dependency graphs) stored in `sessionStorage`.

**Remediation:** Store only the analysis ID and always fetch from API.

---

### 5.6 LOW: Hardcoded Fallback API URL Exposes Development Server

**Files:** `frontend/src/hooks/useGitHubRepos.ts` (line 6), `useOwnerRepos.ts` (line 7)

Fallback to `http://localhost:8000` (plain HTTP). Inconsistent with main API client.

**Remediation:** Use the same relative `/api` base URL pattern as `client.ts`.

---

### 5.7 MEDIUM: Password Sent to Server-Side Validation Endpoint

**File:** `frontend/src/api/client.ts` (lines 274-282)

Plaintext password sent over network for validation unnecessarily. Creates additional exposure.

**Remediation:** Implement password validation entirely client-side.

---

### 5.8 MEDIUM: Missing CSRF Protection (Defense-in-Depth)

**File:** `frontend/src/api/client.ts`

Bearer token usage provides some CSRF protection, but no `SameSite` cookie config or anti-CSRF tokens as defense-in-depth.

**Remediation:** Ensure `SameSite=Strict` on any auth cookies. Add CSRF tokens as defense-in-depth.

---

### 5.9 LOW: Clickjacking Protection Not Enforced

No `X-Frame-Options` or CSP `frame-ancestors` observed. Sensitive actions (account deletion, password changes) could be targeted via clickjacking.

**Remediation:** Configure `X-Frame-Options: DENY` or `frame-ancestors 'none'` headers.

---

### 5.10 MEDIUM: Broad GitHub OAuth Scope Request

**File:** `frontend/src/hooks/useAuth.ts` (lines 137-145)

The `repo` scope grants full read/write access to all repositories. Combined with localStorage storage (5.1), a compromised token gives an attacker full repo access.

**Remediation:** Use `public_repo` or GitHub App tokens with fine-grained permissions.

---

### 5.11 LOW: Server Error Details Displayed to Users

**Files:** `frontend/src/components/chat/ChatPanel.tsx`, `ChatWidget.tsx`, `AnalyzeSection.tsx`, `ProfileSettingsPage.tsx`

Raw server error messages (from `err?.response?.data?.detail`) displayed directly. React escapes prevent XSS but info disclosure persists.

**Remediation:** Map server errors to user-friendly messages client-side.

---

### 5.12 INFO: Source Code Panel Rendering — Safe

**File:** `frontend/src/components/SourceCodePanel.tsx` (lines 365-380)

`react-syntax-highlighter` properly escapes all content. No XSS risk. **Positive finding.**

---

### 5.13 INFO: Tool Result Display — Safe

**File:** `frontend/src/components/chat/ToolResultBlock.tsx` (lines 125-151)

Tool outputs rendered in `<pre>` tags with React auto-escaping. **Positive finding.**

---

### 5.14 INFO: Chat Message User Content — Safe

**File:** `frontend/src/components/chat/ChatMessage.tsx` (lines 87-93)

User messages rendered as plain text. Assistant messages use `react-markdown`. **Positive finding.**

---

### 5.15 INFO: No `dangerouslySetInnerHTML` Usage Detected

All 31 reviewed frontend files use safe JSX rendering patterns. **Strong positive finding.**

---

## Priority Remediation Roadmap

### Immediate (Week 1)
1. **Fix shell injection** (3.1): Use `shlex.quote()` on GIT_ASKPASS token — **RCE risk**
2. **Add ownership checks** (1.1, 1.2, 2.5): Add `user_id` filtering to `get_analysis_result()` and `get_analysis_status()` — **IDOR**
3. **Authenticate GitHub proxy** (2.1): Add `Depends(get_current_user)` to repo-content endpoint
4. **Verify current password** (1.5/2.2): Validate `current_password` before password change
5. **Remove console.log of tokens** (1.12, 5.3): Delete all token-logging statements

### Short-Term (Weeks 2-3)
6. **Add symlink checks** (3.2): Filter symlinks in `parse_file` and `walk_directory`
7. **Restrict local analysis paths** (2.3, 3.4): Implement allowlist or disable in production
8. **Add rate limiting** (2.7): Apply to `/api/analyze` and `/api/analysis/{id}/rundown`
9. **Add repo size/file limits** (3.3): Clone timeout, file count cap, size checks
10. **Fix conversation IDOR** (4.2): Add `user_id` to `ConversationState`
11. **Reduce OAuth scope** (5.10): Replace `repo` with `public_repo` + fine-grained tokens
12. **Move tokens from localStorage** (5.1, 1.7): Use httpOnly cookies or server-side sessions

### Medium-Term (Weeks 4-6)
13. **Sanitize error responses** (1.6, 2.8, 4.6): Generic messages to clients, detailed server-side logs
14. **Add request size limits** (2.10): Middleware + `max_length` on all string fields
15. **Add SSE timeout/disconnect** (2.11): `asyncio.timeout()` + `request.is_disconnected()`
16. **Implement conversation truncation** (4.4): Max history size + token budget
17. **Restrict CORS** (1.10, 2.12): Explicit methods, headers, and env-based origins
18. **Centralize logging** (4.9, 4.12): Remove `logging.basicConfig` from `llm_analyzer.py`
19. **Add job eviction** (3.9): TTL-based cleanup of in-memory analysis jobs

### Long-Term
20. **Use RLS-enforced client** (1.13, 3.10): Reserve admin client for admin operations only
21. **Add prompt injection defenses** (4.1): Input sanitization layer for all LLM prompts
22. **Add CSP headers** (5.9): `frame-ancestors 'none'`, strict `script-src`
23. **Atomic account deletion** (1.15): Database transaction via Supabase RPC
24. **Client-side password validation** (1.8, 5.7): Remove server-side endpoint
