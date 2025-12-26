⏺ I've successfully launched three implementation-strategist agents in parallel to develop comprehensive strategies for your GitHub repository selection feature. Here's what each agent focused on:

  Agent 1: GitHub OAuth Authentication Strategy (ad6052d)

  Key Recommendations:
  - Leverage Supabase's built-in GitHub OAuth provider rather than custom implementation (simpler, more secure)
  - Request scopes: repo, read:user, user:email for full repository access
  - Store GitHub provider token in session only (not localStorage for security)
  - Update profiles table with GitHub metadata (username, ID, avatar)

  Implementation approach:
  - Add signInWithGitHub() method to useAuth hook
  - Create /auth/callback route for OAuth redirect handling
  - Add GitHub sign-in button to AuthModal.tsx
  - Backend validates tokens and provides GitHub API endpoints

  ---
  Agent 2: GitHub Repository Browser Integration (a1df376)

  Key Recommendations:
  - Use React Query (TanStack Query) for efficient caching and pagination
  - Implement infinite scroll with virtual scrolling for users with many repos (100+)
  - Show repository metadata: name, description, language, stars, last update
  - Support search, filtering (public/private), and sorting

  Implementation approach:
  - Create /api/github/repos endpoint to fetch user's repositories
  - Build GitHubRepoSelector component with search and pagination
  - Use shallow git clone (--depth 1) to temp directory for analysis
  - Automatic cleanup of temporary directories after analysis

  ---
  Agent 3: UploadPage UI Integration (a4d37d9)

  Key Recommendations:
  - Use tabbed interface (not radio buttons or toggle) in the Analyze Section
  - Two tabs: "Local Directory" and "GitHub Repository"
  - Extend /api/analyze endpoint to accept both local paths and GitHub repos (polymorphic request)
  - Shared options UI for both modes (node_modules checkbox, max depth)

  Implementation approach:
  - Create GitHubRepoForm.tsx component with authentication gate
  - Update AnalyzeRequest schema to support discriminated union (local vs GitHub)
  - Parse GitHub URLs using regex pattern from existing GithubEmbed.tsx
  - Transform GitHub repo data to analysis request format

  ---
  Unified Implementation Phases

  All three agents recommend a phased approach:

  Phase 1 (MVP - 2-3 days):

  - Configure GitHub OAuth in Supabase
  - Add tab UI to UploadPage
  - GitHub URL input with validation
  - Extend /analyze endpoint for GitHub repos

  Phase 2 (Enhancement - 1-2 days):

  - Full OAuth integration
  - Private repository support
  - Repository list browser

  Phase 3 (Polish - 2-3 days):

  - Performance optimizations (virtual scrolling, caching)
  - Enhanced UX (recent repos, metadata display)
  - Comprehensive error handling

  ---
  Key Files to Create/Modify

  New Files:
  - frontend/src/components/GitHubRepoForm.tsx
  - frontend/src/components/github/GitHubRepoSelector.tsx
  - frontend/src/hooks/useGitHubRepos.ts
  - frontend/src/pages/AuthCallback.tsx
  - backend/app/services/github.py
  - supabase/migrations/002_github_oauth.sql

  Modified Files:
  - frontend/src/pages/UploadPage.tsx - Add tabs and GitHub form
  - frontend/src/hooks/useAuth.ts - Add GitHub OAuth methods
  - frontend/src/components/AuthModal.tsx - Add GitHub sign-in button
  - backend/app/api/routes.py - Extend /analyze, add /github/repos
  - backend/app/models/schemas.py - Update AnalyzeRequest schema