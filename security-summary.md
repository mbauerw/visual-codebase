GitHub Integration Security Review

       Executive Summary

       This security review focuses on the GitHub integration within the Visual Codebase application. I have identified several security
       vulnerabilities and areas of concern ranging from Critical to Low severity. The findings cover token handling, command injection risks, path
       traversal vulnerabilities, and OAuth implementation weaknesses.

       ---
       Findings

       1. CRITICAL: GitHub Token Exposed in Clone URL (Credential Leakage)

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       Lines: 55-59

       # Build clone URL
       clone_url = f"https://github.com/{repo_info.owner}/{repo_info.repo}.git"

       # Use authenticated URL if token is available
       if self.access_token and self.access_token != "":
           clone_url = f"https://{self.access_token}@github.com/{repo_info.owner}/{repo_info.repo}.git"

       Issue: The GitHub OAuth token is embedded directly in the clone URL. This creates several security risks:

       1. Process listing exposure: The token will be visible in process listings (ps aux) since it is passed as a command-line argument to git 
       clone
       2. Log file exposure: Git may log this URL (with the token) in error messages
       3. Shell history: The URL may be captured in shell history or debugging logs

       Remediation: Use Git credential helpers or pass credentials via environment variables:
       # Better approach: Use Git credential helper via environment
       env = os.environ.copy()
       env['GIT_ASKPASS'] = '/usr/bin/echo'  # or a custom credential helper script
       # Or use: git clone URL with token via stdin

       ---
       2. HIGH: Insufficient Input Validation for Repository Owner/Repo (Potential Command Injection)

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       Lines: 55-70

       clone_url = f"https://github.com/{repo_info.owner}/{repo_info.repo}.git"
       # ...
       branch = repo_info.branch or "main"
       cmd = [
           "git",
           "clone",
           "--depth", "1",
           "--single-branch",
           "--branch", branch,
           clone_url,
           str(temp_dir)
       ]

       Issue: While the code uses asyncio.create_subprocess_exec() (which is safer than shell=True), there is no validation of repo_info.owner,
       repo_info.repo, or repo_info.branch values before they are used in the git command. The GitHubRepoInfo model in
       /Users/maxbauer/Documents/visual-codebase/backend/app/models/schemas.py has no field validators:

       class GitHubRepoInfo(BaseModel):
           """GitHub repository information."""
           owner: str = Field(..., description="Repository owner")
           repo: str = Field(..., description="Repository name")
           branch: Optional[str] = Field(default=None, description="Branch to analyze")
           path: Optional[str] = Field(default=None, description="Subdirectory path")

       A malicious user could potentially:
       - Inject special characters that could affect git behavior
       - Use branch names with dangerous characters
       - Exploit git's URL parsing

       Remediation: Add regex validators to the Pydantic model:
       from pydantic import Field, field_validator
       import re

       class GitHubRepoInfo(BaseModel):
           owner: str = Field(..., description="Repository owner")
           repo: str = Field(..., description="Repository name")
           branch: Optional[str] = Field(default=None, description="Branch to analyze")

           @field_validator('owner', 'repo')
           @classmethod
           def validate_github_name(cls, v):
               if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$', v):
                   raise ValueError('Invalid GitHub repository or owner name')
               return v

           @field_validator('branch')
           @classmethod
           def validate_branch(cls, v):
               if v and not re.match(r'^[a-zA-Z0-9._/-]+$', v):
                   raise ValueError('Invalid branch name')
               return v

       ---
       3. HIGH: Path Traversal Vulnerability in Subdirectory Path

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       Lines: 92-97

       # If a subdirectory path is specified, return that path
       if repo_info.path:
           repo_path = temp_dir / repo_info.path
           if not repo_path.exists():
               raise RuntimeError(f"Subdirectory {repo_info.path} does not exist in repository")
           return repo_path

       Issue: The repo_info.path value is used directly without sanitization. An attacker could provide a path like ../../etc to escape the
       temporary directory, potentially accessing sensitive files on the server (though the main risk here is more limited since it is concatenated
       with temp_dir).

       Remediation: Validate that the resolved path remains within the temp directory:
       if repo_info.path:
           repo_path = (temp_dir / repo_info.path).resolve()
           if not repo_path.is_relative_to(temp_dir.resolve()):
               raise ValueError("Invalid subdirectory path - path traversal detected")
           if not repo_path.exists():
               raise RuntimeError(f"Subdirectory {repo_info.path} does not exist")
           return repo_path

       ---
       4. HIGH: Path Traversal in File Content Endpoint

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py

       Lines: 307-326

       # For local analyses, try to read from filesystem
       import os
       directory_path = result.get("directory_path")
       relative_path = result.get("file_path")  # The actual relative path from the node
       if directory_path and relative_path:
           file_path = os.path.join(directory_path, relative_path)
           if os.path.exists(file_path):
               try:
                   with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                       content = f.read()

       Issue: The relative_path is retrieved from the database (originally from the node_id parameter in the URL). While the node data comes from
       the database, an attacker who can manipulate database records or exploit SQL injection could potentially read arbitrary files on the server
       by using paths like ../../../../etc/passwd.

       Remediation: Add path traversal protection:
       if directory_path and relative_path:
           base_path = os.path.realpath(directory_path)
           file_path = os.path.realpath(os.path.join(directory_path, relative_path))

           # Ensure the resolved path is within the base directory
           if not file_path.startswith(base_path + os.sep):
               raise HTTPException(status_code=400, detail="Invalid file path")

       ---
       5. MEDIUM: GitHub Token Stored in localStorage (XSS Risk)

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/pages/AuthCallback.tsx

       Lines: 40-43

       // Store GitHub provider token in localStorage for persistence
       if (session.provider_token) {
         localStorage.setItem('github_provider_token', session.provider_token);
       }

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/hooks/useAuth.ts

       Lines: 35-41

       // Fallback to localStorage if provider_token is not in session
       const storedToken = localStorage.getItem('github_provider_token')
       if (storedToken) {
         console.log('Using stored GitHub token from localStorage')
         githubToken = storedToken
       }

       Issue: Storing OAuth tokens in localStorage makes them vulnerable to XSS attacks. If an attacker can execute JavaScript on the page, they can
        steal the GitHub token.

       Remediation:
       - Store tokens in HTTP-only cookies instead of localStorage
       - If localStorage must be used, implement additional protections like token encryption
       - Consider using short-lived tokens and refresh mechanisms
       - Implement Content Security Policy (CSP) headers to mitigate XSS

       ---
       6. MEDIUM: Debug Logging of Sensitive Tokens

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/pages/AuthCallback.tsx

       Line: 38

       // Debug: Log provider token
       console.log('OAuth callback - Provider token:', session.provider_token);

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/hooks/useAuth.ts

       Lines: 29-31

       // Debug logging
       console.log('Session:', session)
       console.log('Provider token:', session?.provider_token)
       console.log('Provider refresh token:', session?.provider_refresh_token)

       Issue: OAuth tokens are being logged to the browser console. This is a significant security concern as:
       - Browser developer tools could expose these tokens
       - Browser extensions could capture console output
       - Logs might be captured by error monitoring services

       Remediation: Remove all console.log statements that output tokens or sensitive session data before production deployment.

       ---
       7. MEDIUM: Inadequate Rate Limiting Handling

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       Lines: 143-195 (list_user_repos) and 197-264 (list_owner_repos)**

       Issue: While the code handles GitHub API errors, there is no:
       - Exponential backoff for rate-limited requests
       - Caching of GitHub API responses
       - Proper handling of rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset)

       The application could repeatedly hit rate limits, leading to service degradation and poor user experience.

       Remediation: Implement rate limit awareness:
       async def _handle_rate_limit(self, response: httpx.Response):
           remaining = int(response.headers.get("X-RateLimit-Remaining", 0))
           reset_time = int(response.headers.get("X-RateLimit-Reset", 0))

           if remaining < 10:
               logger.warning(f"GitHub API rate limit low: {remaining} remaining, resets at {reset_time}")

           if response.status_code == 403 and remaining == 0:
               wait_time = reset_time - time.time()
               if wait_time > 0:
                   raise RateLimitError(f"Rate limited. Retry after {wait_time} seconds", retry_after=wait_time)

       ---
       8. MEDIUM: No Timeout on Git Clone Operations

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       Lines: 75-83

       process = await asyncio.create_subprocess_exec(
           *cmd,
           stdout=asyncio.subprocess.PIPE,
           stderr=asyncio.subprocess.PIPE
       )

       stdout, stderr = await process.communicate()

       Issue: The git clone operation has no timeout. A malicious or extremely large repository could cause the operation to hang indefinitely,
       consuming server resources.

       Remediation: Add a timeout:
       try:
           stdout, stderr = await asyncio.wait_for(
               process.communicate(),
               timeout=300  # 5 minute timeout
           )
       except asyncio.TimeoutError:
           process.kill()
           raise RuntimeError("Repository clone timed out")

       ---
       9. MEDIUM: Supabase Configuration Logged to Console

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/config/supabase.ts

       Lines: 10-11

       console.log('Supabase URL:', supabaseUrl)
       console.log('Has Anon Key:', !!supabaseAnonKey)

       Issue: While the anon key presence is only logged as a boolean, the Supabase URL is logged in full. This could expose infrastructure details
       in production.

       Remediation: Remove these debug logs before production deployment or wrap them in development-only conditionals.

       ---
       10. LOW: Open Redirect Potential in Auth Callback

       File: /Users/maxbauer/Documents/visual-codebase/frontend/src/pages/AuthCallback.tsx

       Lines: 45-47

       // Get the intended redirect URL from sessionStorage or default to home
       const redirectTo = sessionStorage.getItem('auth_redirect') || '/';
       sessionStorage.removeItem('auth_redirect');

       Issue: The redirect URL is retrieved from sessionStorage without validation. If an attacker can write to sessionStorage (via XSS), they could
        redirect users to a malicious site after authentication.

       Remediation: Validate that the redirect URL is a relative path or belongs to the application domain:
       const validateRedirectUrl = (url: string): string => {
         if (!url || url.startsWith('/') && !url.startsWith('//')) {
           return url || '/';
         }
         try {
           const parsed = new URL(url, window.location.origin);
           if (parsed.origin === window.location.origin) {
             return parsed.pathname + parsed.search;
           }
         } catch {
           // Invalid URL
         }
         return '/';
       };

       const redirectTo = validateRedirectUrl(sessionStorage.getItem('auth_redirect') || '/');

       ---
       11. LOW: Temporary Directory Cleanup Not Guaranteed

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/api/routes.py

       Lines: 158-161

       finally:
           # Clean up temporary directory
           if temp_dir:
               GitHubService.cleanup(temp_dir)

       Issue: While cleanup is in a finally block, if the server crashes or the process is killed during analysis, temporary directories containing
       cloned repositories (potentially with sensitive code) will persist on disk.

       Remediation:
       - Implement a periodic cleanup job for orphaned temp directories
       - Use system temporary directories with automatic cleanup policies
       - Consider using temporary file managers like tempfile.TemporaryDirectory with context managers

       ---
       12. LOW: Missing HTTPS Enforcement for GitHub API Calls

       File: /Users/maxbauer/Documents/visual-codebase/backend/app/services/github.py

       The code uses HTTPS URLs for GitHub API calls, which is correct. However, there is no explicit SSL certificate verification enforcement.

       Remediation: Ensure httpx client enforces SSL verification (which is the default, but can be explicitly stated):
       async with httpx.AsyncClient(verify=True) as client:

       ---
       Summary Table

       | #   | Finding                                           | Severity | Status |
       |-----|---------------------------------------------------|----------|--------|
       | 1   | GitHub Token in Clone URL                         | Critical | Open   |
       | 2   | Insufficient Input Validation (Command Injection) | High     | Open   |
       | 3   | Path Traversal in Subdirectory                    | High     | Open   |
       | 4   | Path Traversal in File Content Endpoint           | High     | Open   |
       | 5   | Token Stored in localStorage                      | Medium   | Open   |
       | 6   | Debug Logging of Tokens                           | Medium   | Open   |
       | 7   | Inadequate Rate Limiting                          | Medium   | Open   |
       | 8   | No Timeout on Git Clone                           | Medium   | Open   |
       | 9   | Supabase Config Logging                           | Medium   | Open   |
       | 10  | Open Redirect in Auth Callback                    | Low      | Open   |
       | 11  | Temp Directory Cleanup                            | Low      | Open   |
       | 12  | Missing Explicit SSL Enforcement                  | Low      | Open   |

       ---
       Recommendations (Priority Order)

       1. Immediate: Fix the GitHub token exposure in clone URLs - use Git credential helpers
       2. Immediate: Add input validation to GitHubRepoInfo model with regex validators
       3. Immediate: Implement path traversal protection in both the GitHub service and file content endpoint
       4. High Priority: Remove all debug console.log statements that expose tokens
       5. High Priority: Move token storage from localStorage to HTTP-only cookies
       6. Medium Priority: Implement timeouts for git clone operations
       7. Medium Priority: Add proper rate limit handling with backoff and caching
       8. Low Priority: Validate redirect URLs in auth callback
       9. Low Priority: Implement periodic cleanup of orphaned temp directories