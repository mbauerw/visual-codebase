# Resume — Project Entry

**Codebase Remap**, AI-powered codebase visualization tool
Creator and Sole Developer | 2026
Web app that analyzes a local project or GitHub repository and renders it as an interactive, navigable dependency graph.
Parses source files with Tree-sitter AST parsing across 8 languages (JavaScript/TypeScript, Python, Java, C#, Go, Rust, Swift), resolving imports — including path aliases, Java packages, and C# namespaces — into cross-language dependency edges.
Uses Claude to classify each file's architectural role (component, service, model, etc.) and to generate plain-language summaries and a guided "Rundown" walkthrough of the codebase.
Features an integrated AI chat assistant with intent classification and tool use for asking questions about the analyzed codebase.
Analysis runs as asynchronous background jobs with live progress tracking through a multi-stage pipeline (parse → LLM analysis → graph build → persist).
Supports GitHub OAuth for browsing and analyzing private repositories, with user accounts and a saved-analysis history backed by Supabase's cloud-hosted Postgres with row-level security.
Tech Stack: React, TypeScript, Vite, React Flow, FastAPI, Python, Tree-sitter, Anthropic API (Claude), Supabase (Postgres + Auth), Vitest, pytest
