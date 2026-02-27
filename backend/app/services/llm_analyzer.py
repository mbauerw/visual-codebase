"""LLM-based semantic analysis service using Claude."""
import asyncio
import json
import os
import re
from typing import Callable, Optional
import logging

import anthropic

# Type alias for progress callback: (batch_number, total_batches, files_in_batch) -> None
ProgressCallback = Callable[[int, int, int], None]

from ..settings import get_settings
from ..models.schemas import (
    ArchitecturalRole,
    Category,
    LLMFileAnalysis,
    ParsedFile,
)

logger = logging.getLogger(__name__)


def _sanitize_for_prompt(text: str, max_length: int = 200) -> str:
    """Sanitize user-derived text before embedding in LLM prompts.

    Strips control characters, truncates long strings, and removes
    patterns commonly used in prompt injection attacks.
    """
    if not text:
        return text
    # Remove control characters (except newlines and tabs)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length] + "..."
    return text

class LLMAnalyzer:
    """Service for analyzing codebase files using Claude."""

    def __init__(self):
        """Initialize the Anthropic client with async support."""
        self.settings = get_settings()
        # Use AsyncAnthropic to avoid blocking the event loop during API calls
        self.client = anthropic.AsyncAnthropic(api_key=self.settings.anthropic_api_key)

    def _build_file_summary(self, files: list[ParsedFile]) -> str:
        """Build a summary of files for the LLM prompt."""
        summaries = []
        for f in files:
            # Sanitize all user-derived strings before embedding in prompt
            # Format imports (limit to 10)
            imports_str = ", ".join([_sanitize_for_prompt(imp.module, 100) for imp in f.imports[:10]])
            if len(f.imports) > 10:
                imports_str += f"... (+{len(f.imports) - 10} more)"

            # Format functions (limit to 15)
            functions_str = ", ".join([_sanitize_for_prompt(fn, 100) for fn in f.functions[:15]])
            if len(f.functions) > 15:
                functions_str += f"... (+{len(f.functions) - 15} more)"

            # Format classes (limit to 10)
            classes_str = ", ".join([_sanitize_for_prompt(cls, 100) for cls in f.classes[:10]])
            if len(f.classes) > 10:
                classes_str += f"... (+{len(f.classes) - 10} more)"

            sanitized_path = _sanitize_for_prompt(f.relative_path, 300)
            summary = f"- {sanitized_path} ({f.language.value}, {f.line_count} lines)\n"
            summary += f"  Imports: {imports_str or 'none'}\n"
            summary += f"  Functions: {functions_str or 'none'}\n"
            summary += f"  Classes: {classes_str or 'none'}"

            summaries.append(summary)
        return "\n".join(summaries)

    def _get_analysis_prompt(
        self, directory_name: str, files: list[ParsedFile]
    ) -> str:
        """Generate the analysis prompt for Claude."""
        file_summary = self._build_file_summary(files)

        return f"""You are analyzing a codebase. Here is information about files in the "{directory_name}" directory:

        {file_summary}

        For each file, provide:
        1. architectural_role: The role this file plays. Use one of these values:
           - Common: react_component, utility, api_service, model, config, test, hook, context, store, middleware, controller, router, schema
           - Java/C# Backend: entity, repository, service, dto, exception, enum_type, interface, annotation
           - C# specific: extension, record, delegate
           - Go: go_handler, go_middleware, go_repository, go_service, go_model, go_cmd, go_pkg, go_internal, go_transport, go_config, go_util
           - Rust: rust_lib, rust_bin, rust_mod, rust_trait, rust_impl, rust_handler, rust_error, rust_macro, rust_types, rust_tests
           - Swift/iOS: swift_view_controller, swift_ui_view, swift_app_delegate, swift_protocol, swift_extension, swift_coordinator, swift_view_model, swift_data_source, swift_network_service, swift_core_data, swift_observable
           - unknown (if none fit)
        2. description: 1-3 sentence description of what this file does. Base this on the function names, class names, and imports. Be specific - mention key functions/classes by name when relevant. Do not just describe the file path.
        3. category: High-level category. Use one of: frontend, backend, shared, infrastructure, test, config, unknown

        For Java files, consider these role mappings:
        - entity: Classes with @Entity, @Table, or representing database entities
        - repository: Classes with @Repository or extending JpaRepository/CrudRepository
        - service: Classes with @Service or *Service.java naming
        - controller: Classes with @Controller, @RestController, or *Controller.java
        - dto: Data transfer objects (*DTO.java, *Request.java, *Response.java)
        - exception: Custom exception classes
        - interface: Interface definitions
        - annotation: Custom annotation definitions (@interface)
        - enum_type: Enum definitions
        - config: Classes with @Configuration or config-related

        For C# files, consider these role mappings:
        - controller: Classes with [ApiController], *Controller.cs, inheriting ControllerBase
        - service: *Service.cs in Services folder
        - entity: DbContext entities, classes with DbSet<>, IEntityTypeConfiguration
        - dto: *Dto.cs, *Request.cs, *Response.cs
        - interface: I*.cs with interface declaration
        - extension: Static classes with extension methods (this parameter)
        - record: Classes using 'record' keyword
        - delegate: Delegate type definitions
        - enum_type: Enum definitions
        - exception: Custom exception classes

        For Go files, consider these role mappings based on directory structure and patterns:
        - go_cmd: Files in cmd/ directory (main packages, entry points)
        - go_internal: Files in internal/ directory (private packages)
        - go_pkg: Files in pkg/ directory (public reusable packages)
        - go_handler: HTTP handlers, request handlers (*_handler.go, handlers/)
        - go_service: Business logic (*_service.go, service/)
        - go_repository: Data access (*_repository.go, repository/, store/)
        - go_model: Data structures, types (models/, types/, entities/)
        - go_middleware: HTTP middleware (middleware/)
        - go_transport: HTTP/gRPC transport layer (transport/, http/, grpc/)
        - go_config: Configuration (config/, *_config.go)
        - go_util: Utilities and helpers (util/, utils/, helpers/, pkg/*)

        For Rust files, consider these role mappings:
        - rust_lib: lib.rs - library crate root
        - rust_bin: main.rs - binary crate root
        - rust_mod: mod.rs - module declaration files
        - rust_trait: Trait definitions (*_trait.rs, contains trait keyword)
        - rust_impl: Heavy impl blocks, implementation files
        - rust_handler: HTTP handlers (#[get], #[post] attributes, route handlers)
        - rust_error: Error types (error.rs, Error enum/struct definitions)
        - rust_macro: Macro definitions (macro_rules!)
        - rust_types: Type definitions, models (types.rs, models.rs, structs)
        - rust_tests: Test modules (tests/, #[cfg(test)], *_test.rs)

        For Swift files, consider these role mappings:
        - swift_view_controller: UIViewController subclasses, *ViewController.swift
        - swift_ui_view: SwiftUI View structs, files importing SwiftUI with View conformance
        - swift_app_delegate: AppDelegate.swift, SceneDelegate.swift, @main/@UIApplicationMain
        - swift_protocol: Protocol definitions (*Protocol.swift, primarily protocol keyword)
        - swift_extension: Extension-only files (extension keyword, *+Extension.swift)
        - swift_coordinator: Coordinator pattern (*Coordinator.swift, navigation coordinators)
        - swift_view_model: *ViewModel.swift, @Published/@Observable properties
        - swift_data_source: UITableViewDataSource, UICollectionViewDataSource implementations
        - swift_network_service: URLSession-based networking, API clients (*Service.swift, *API.swift)
        - swift_core_data: NSManagedObject subclasses, Core Data models
        - swift_observable: @Observable/@ObservableObject classes
        - model: Plain data structs/classes, Codable types (*Model.swift, models/)
        - utility: Helper extensions, utility functions (utils/, helpers/)
        - test: XCTest classes (*Tests.swift, *Spec.swift)

        Return ONLY a valid JSON array with no additional text. Format:
        [{{"filename": "example.ts", "architectural_role": "utility", "description": "Provides helper functions for...", "category": "shared"}}]

        Important:
        - Return ONLY the JSON array, no markdown code blocks or explanations
        - Use the exact enum values provided
        - Include an entry for EVERY file listed above
        - Write descriptions that reference the actual function/class names found in the file
        - If uncertain, use "unknown" for role/category"""

    def _parse_role(self, role_str: str) -> ArchitecturalRole:
        """Parse a role string to enum, with fallback."""
        try:
            return ArchitecturalRole(role_str.lower())
        except ValueError:
            return ArchitecturalRole.UNKNOWN

    def _parse_category(self, category_str: str) -> Category:
        """Parse a category string to enum, with fallback."""
        try:
            return Category(category_str.lower())
        except ValueError:
            return Category.UNKNOWN

    def _parse_llm_response(self, response: str) -> list[LLMFileAnalysis]:
        """Parse the LLM response into structured data."""
        # Clean up response - remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```"):
            # Remove markdown code block
            lines = response.split("\n")
            response = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            response = response.strip()

        try:
            data = json.loads(response)
            results = []
            for item in data:
                results.append(
                    LLMFileAnalysis(
                        filename=item.get("filename", ""),
                        architectural_role=self._parse_role(
                            item.get("architectural_role", "unknown")
                        ),
                        description=item.get("description", ""),
                        category=self._parse_category(
                            item.get("category", "unknown")
                        ),
                    )
                )
            return results
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response: {e}")
            print(f"Response was: {response[:500]}")
            return []

    async def analyze_batch(
        self, files: list[ParsedFile], directory_name: str
    ) -> list[LLMFileAnalysis]:
        """Analyze a batch of files using Claude."""
        if not files:
            return []

        prompt = self._get_analysis_prompt(directory_name, files)

        try:
            # Use await for async client to avoid blocking the event loop
            message = await self.client.messages.create(
                model=self.settings.llm_model,
                max_tokens=self.settings.llm_max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text
            return self._parse_llm_response(response_text)

        except Exception as e:
            print(f"LLM analysis failed: {e}")
            # Return basic analysis without LLM insights
            return [
                LLMFileAnalysis(
                    filename=f.name,
                    architectural_role=self._infer_role_from_path(f.relative_path),
                    description=f"File in {os.path.dirname(f.relative_path) or 'root'}",
                    category=self._infer_category_from_path(f.relative_path),
                )
                for f in files
            ]

    def _infer_role_from_path(self, path: str) -> ArchitecturalRole:
        """Infer architectural role from file path patterns.

        Order matters: directory-based patterns are checked before
        extension/naming patterns to avoid false positives (e.g.,
        'userStore.ts' matching 'use*' hook pattern).
        """
        path_lower = path.lower()
        name = os.path.basename(path_lower)
        name_without_ext = name.rsplit(".", 1)[0] if "." in name else name
        is_java = name.endswith(".java")
        is_csharp = name.endswith(".cs")
        is_go = name.endswith(".go")
        is_rust = name.endswith(".rs")

        # Test files (highest priority)
        if "test" in path_lower or "spec" in path_lower or name.startswith("test_"):
            return ArchitecturalRole.TEST

        # Config files
        if any(
            x in name
            for x in (
                "config",
                ".config.",
                "settings",
                ".env",
                "package.json",
                "tsconfig",
                "webpack",
                "vite",
                "eslint",
                "prettier",
            )
        ):
            return ArchitecturalRole.CONFIG

        # Java-specific patterns (check early for Java files)
        if is_java:
            # Repository pattern
            if name_without_ext.endswith("repository") or "repository/" in path_lower:
                return ArchitecturalRole.REPOSITORY

            # Service pattern
            if name_without_ext.endswith("service") or name_without_ext.endswith("serviceimpl"):
                return ArchitecturalRole.SERVICE

            # Controller pattern
            if name_without_ext.endswith("controller"):
                return ArchitecturalRole.CONTROLLER

            # Entity pattern
            if "entity/" in path_lower or "entities/" in path_lower or "domain/" in path_lower:
                return ArchitecturalRole.ENTITY

            # DTO pattern
            if name_without_ext.endswith("dto") or name_without_ext.endswith("request") or name_without_ext.endswith("response"):
                return ArchitecturalRole.DTO

            # Exception pattern
            if name_without_ext.endswith("exception") or "exception/" in path_lower:
                return ArchitecturalRole.EXCEPTION

            # Interface pattern (I* prefix is common in Java)
            if "interface/" in path_lower:
                return ArchitecturalRole.INTERFACE

            # Configuration pattern
            if "config/" in path_lower or name_without_ext.endswith("config") or name_without_ext.endswith("configuration"):
                return ArchitecturalRole.CONFIG

        # C#-specific patterns (check early for C# files)
        if is_csharp:
            # Controller pattern
            if name_without_ext.endswith("controller") or "controllers/" in path_lower:
                return ArchitecturalRole.CONTROLLER

            # Service pattern
            if name_without_ext.endswith("service") or "services/" in path_lower:
                return ArchitecturalRole.SERVICE

            # Repository pattern
            if name_without_ext.endswith("repository") or "repositories/" in path_lower:
                return ArchitecturalRole.REPOSITORY

            # Entity pattern
            if "entities/" in path_lower or "models/" in path_lower or "domain/" in path_lower:
                return ArchitecturalRole.ENTITY

            # DTO pattern
            if name_without_ext.endswith("dto") or name_without_ext.endswith("request") or name_without_ext.endswith("response"):
                return ArchitecturalRole.DTO

            # Interface pattern (I* prefix is common in C#)
            if name_without_ext.startswith("i") and name_without_ext[1:2].isupper():
                return ArchitecturalRole.INTERFACE

            # Extension pattern
            if name_without_ext.endswith("extensions") or "extensions/" in path_lower:
                return ArchitecturalRole.EXTENSION

            # Exception pattern
            if name_without_ext.endswith("exception") or "exceptions/" in path_lower:
                return ArchitecturalRole.EXCEPTION

            # Configuration pattern
            if "config/" in path_lower or name_without_ext.endswith("config") or name_without_ext.endswith("configuration"):
                return ArchitecturalRole.CONFIG

        # Go-specific patterns
        if is_go:
            # Test files (handled above, but be explicit)
            if name.endswith("_test.go"):
                return ArchitecturalRole.TEST

            # cmd/ directory - entry points
            if "/cmd/" in path_lower or path_lower.startswith("cmd/"):
                return ArchitecturalRole.GO_CMD

            # internal/ directory - private packages
            if "/internal/" in path_lower or path_lower.startswith("internal/"):
                return ArchitecturalRole.GO_INTERNAL

            # pkg/ directory - public packages
            if "/pkg/" in path_lower or path_lower.startswith("pkg/"):
                return ArchitecturalRole.GO_PKG

            # Handler pattern
            if name_without_ext.endswith("_handler") or name_without_ext.endswith("handler") or "handler/" in path_lower or "handlers/" in path_lower:
                return ArchitecturalRole.GO_HANDLER

            # Service pattern
            if name_without_ext.endswith("_service") or name_without_ext.endswith("service") or "service/" in path_lower or "services/" in path_lower:
                return ArchitecturalRole.GO_SERVICE

            # Repository pattern
            if name_without_ext.endswith("_repository") or name_without_ext.endswith("repository") or "repository/" in path_lower or "repositories/" in path_lower or "store/" in path_lower:
                return ArchitecturalRole.GO_REPOSITORY

            # Model pattern
            if "model/" in path_lower or "models/" in path_lower or "types/" in path_lower or "entities/" in path_lower or "entity/" in path_lower:
                return ArchitecturalRole.GO_MODEL

            # Middleware pattern
            if "middleware/" in path_lower or name_without_ext.endswith("middleware"):
                return ArchitecturalRole.GO_MIDDLEWARE

            # Transport pattern (HTTP/gRPC)
            if "transport/" in path_lower or "http/" in path_lower or "grpc/" in path_lower or "api/" in path_lower:
                return ArchitecturalRole.GO_TRANSPORT

            # Config pattern
            if "config/" in path_lower or name_without_ext.endswith("_config") or name_without_ext == "config":
                return ArchitecturalRole.GO_CONFIG

            # Util pattern
            if "util/" in path_lower or "utils/" in path_lower or "helpers/" in path_lower or "helper/" in path_lower:
                return ArchitecturalRole.GO_UTIL

        # Rust-specific patterns
        if is_rust:
            # Test files
            if name.endswith("_test.rs") or "/tests/" in path_lower or "tests.rs" in name:
                return ArchitecturalRole.RUST_TESTS

            # Crate roots
            if name == "lib.rs":
                return ArchitecturalRole.RUST_LIB
            if name == "main.rs":
                return ArchitecturalRole.RUST_BIN
            if name == "mod.rs":
                return ArchitecturalRole.RUST_MOD

            # Error types
            if name_without_ext == "error" or name_without_ext == "errors" or name_without_ext.endswith("_error"):
                return ArchitecturalRole.RUST_ERROR

            # Trait files
            if name_without_ext.endswith("_trait") or name_without_ext.endswith("traits"):
                return ArchitecturalRole.RUST_TRAIT

            # Handler pattern (common in web frameworks)
            if name_without_ext.endswith("_handler") or name_without_ext == "handlers" or "handlers/" in path_lower:
                return ArchitecturalRole.RUST_HANDLER

            # Types/models
            if name_without_ext in ("types", "models", "schema") or "models/" in path_lower or "types/" in path_lower:
                return ArchitecturalRole.RUST_TYPES

            # Macro files
            if name_without_ext.endswith("_macro") or name_without_ext == "macros":
                return ArchitecturalRole.RUST_MACRO

        # Swift-specific patterns
        is_swift = name.endswith(".swift")
        if is_swift:
            # Test files
            if name_without_ext.endswith("tests") or name_without_ext.endswith("spec") or "/tests/" in path_lower:
                return ArchitecturalRole.TEST

            # App Delegate / Scene Delegate
            if name_without_ext in ("appdelegate", "scenedelegate"):
                return ArchitecturalRole.SWIFT_APP_DELEGATE

            # View Controller pattern
            if name_without_ext.endswith("viewcontroller") or "viewcontrollers/" in path_lower:
                return ArchitecturalRole.SWIFT_VIEW_CONTROLLER

            # SwiftUI View pattern (check for View in name or views/ directory)
            if name_without_ext.endswith("view") and "views/" in path_lower:
                return ArchitecturalRole.SWIFT_UI_VIEW
            if "swiftui" in path_lower:
                return ArchitecturalRole.SWIFT_UI_VIEW

            # View Model pattern (MVVM)
            if name_without_ext.endswith("viewmodel") or "viewmodels/" in path_lower:
                return ArchitecturalRole.SWIFT_VIEW_MODEL

            # Coordinator pattern
            if name_without_ext.endswith("coordinator") or "coordinators/" in path_lower:
                return ArchitecturalRole.SWIFT_COORDINATOR

            # Network/API Service pattern
            if any(x in name_without_ext for x in ("apiservice", "networkservice", "apimanager", "apiclient")):
                return ArchitecturalRole.SWIFT_NETWORK_SERVICE
            if "networking/" in path_lower or "network/" in path_lower:
                return ArchitecturalRole.SWIFT_NETWORK_SERVICE

            # Protocol pattern
            if "protocols/" in path_lower or name_without_ext.endswith("protocol"):
                return ArchitecturalRole.SWIFT_PROTOCOL

            # Extension pattern (Swift extensions)
            if "extensions/" in path_lower or "+extension" in name_without_ext or name_without_ext.endswith("extensions"):
                return ArchitecturalRole.SWIFT_EXTENSION

            # Core Data pattern
            if "coredata/" in path_lower or name_without_ext.endswith("entity") or "entities/" in path_lower:
                return ArchitecturalRole.SWIFT_CORE_DATA

            # Data Source pattern
            if name_without_ext.endswith("datasource") or "datasources/" in path_lower:
                return ArchitecturalRole.SWIFT_DATA_SOURCE

            # Model pattern
            if "models/" in path_lower or name_without_ext.endswith("model"):
                return ArchitecturalRole.MODEL

            # Service pattern (generic)
            if name_without_ext.endswith("service") or "services/" in path_lower:
                return ArchitecturalRole.API_SERVICE

            # Utility pattern
            if "utils/" in path_lower or "helpers/" in path_lower:
                return ArchitecturalRole.UTILITY

        # Directory-based patterns (check BEFORE extension/naming patterns)

        # Context - check before React components to catch context/AuthContext.tsx
        if "context/" in path_lower or "contexts/" in path_lower:
            return ArchitecturalRole.CONTEXT

        # Store/State - check before hooks to catch store/userStore.ts
        if any(x in path_lower for x in ("store/", "stores/", "redux", "zustand", "state/")):
            return ArchitecturalRole.STORE

        # API/Services
        if any(x in path_lower for x in ("api/", "services/", "service.")):
            return ArchitecturalRole.API_SERVICE

        # Models
        if any(x in path_lower for x in ("models/", "model.", "types/", "schemas/")):
            return ArchitecturalRole.MODEL

        # Middleware
        if "middleware" in path_lower:
            return ArchitecturalRole.MIDDLEWARE

        # Controllers
        if "controller" in path_lower:
            return ArchitecturalRole.CONTROLLER

        # Routers
        if "router" in path_lower or "routes/" in path_lower:
            return ArchitecturalRole.ROUTER

        # Utils - check directory patterns and also filenames like utils.ts, helpers.ts
        if any(x in path_lower for x in ("utils/", "util.", "helpers/", "lib/")):
            return ArchitecturalRole.UTILITY
        # Also match files named utils.* or helper.* directly
        if name_without_ext in ("utils", "util", "helpers", "helper", "common"):
            return ArchitecturalRole.UTILITY

        # Extension/naming patterns (check AFTER directory-based patterns)

        # React components - directory or extension based
        if any(
            x in path_lower for x in ("components/", "pages/", "views/")
        ) or name.endswith((".jsx", ".tsx")):
            return ArchitecturalRole.REACT_COMPONENT

        # Hooks - directory or 'use' prefix (must be after store/api/model checks
        # since 'userStore' starts with 'use' when lowercased)
        if "hooks/" in path_lower or name.startswith("use"):
            return ArchitecturalRole.HOOK

        return ArchitecturalRole.UNKNOWN

    def _infer_category_from_path(self, path: str) -> Category:
        """Infer category from file path patterns."""
        path_lower = path.lower()

        # Test files
        if "test" in path_lower or "spec" in path_lower:
            return Category.TEST

        # Config files
        if any(
            x in path_lower
            for x in ("config", ".config", "settings", ".env", "package.json")
        ):
            return Category.CONFIG

        # Frontend patterns
        if any(
            x in path_lower
            for x in (
                "frontend/",
                "client/",
                "src/components",
                "src/pages",
                "src/views",
                "src/hooks",
                "src/context",
                ".jsx",
                ".tsx",
            )
        ):
            return Category.FRONTEND

        # Backend patterns (including Java, C#, and Go)
        if any(
            x in path_lower
            for x in (
                "backend/",
                "server/",
                "api/",
                "controllers/",
                "routes/",
                "middleware/",
                # Java backend patterns
                "src/main/java",
                "repository/",
                "service/",
                "controller/",
                "entity/",
                ".java",
                # C# backend patterns
                ".cs",
                # Go backend patterns
                ".go",
                "cmd/",
                "internal/",
                "pkg/",
                # Rust backend patterns
                ".rs",
                "src/lib.rs",
                "src/main.rs",
            )
        ):
            return Category.BACKEND

        # Shared patterns
        if any(x in path_lower for x in ("shared/", "common/", "utils/", "lib/")):
            return Category.SHARED

        # Infrastructure
        if any(
            x in path_lower
            for x in ("docker", "kubernetes", "terraform", "infra/", ".yml", ".yaml")
        ):
            return Category.INFRASTRUCTURE

        return Category.UNKNOWN

    async def analyze_files(
        self,
        files: list[ParsedFile],
        directory_path: str,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> dict[str, LLMFileAnalysis]:
        """Analyze all files in batches and return a mapping of filename to analysis.

        Uses parallel batch processing to speed up analysis. The number of concurrent
        batches is controlled by the llm_parallel_batches setting.

        Args:
            files: List of parsed files to analyze
            directory_path: Path to the directory being analyzed
            progress_callback: Optional callback for progress updates.
                              Called with (batch_number, total_batches, files_in_batch)
        """
        directory_name = os.path.basename(directory_path.rstrip(os.sep))
        results: dict[str, LLMFileAnalysis] = {}

        # Process in batches
        batch_size = self.settings.max_files_per_batch
        total_batches = (len(files) + batch_size - 1) // batch_size  # Ceiling division

        # Create all batches
        batches = []
        for i in range(0, len(files), batch_size):
            batches.append(files[i : i + batch_size])

        # Semaphore to limit concurrent API calls
        max_concurrent = self.settings.llm_parallel_batches
        semaphore = asyncio.Semaphore(max_concurrent)
        completed_batches = 0
        completed_lock = asyncio.Lock()

        async def process_batch_with_semaphore(batch: list[ParsedFile], batch_num: int) -> list[LLMFileAnalysis]:
            """Process a single batch with semaphore-controlled concurrency."""
            nonlocal completed_batches

            async with semaphore:
                batch_results = await self.analyze_batch(batch, directory_name)

                # Update progress in a thread-safe manner
                async with completed_lock:
                    completed_batches += 1
                    if progress_callback:
                        progress_callback(completed_batches, total_batches, len(batch))

                return batch_results

        # Process all batches in parallel (limited by semaphore)
        logger.info(f"Processing {total_batches} batches with {max_concurrent} concurrent requests")
        batch_tasks = [
            process_batch_with_semaphore(batch, batch_num)
            for batch_num, batch in enumerate(batches, start=1)
        ]
        all_batch_results = await asyncio.gather(*batch_tasks)

        # Combine results from all batches
        for batch_results in all_batch_results:
            for analysis in batch_results:
                # Store by both full path and basename for flexible lookup
                # LLM may return either "App.tsx" or "src/App.tsx"
                results[analysis.filename] = analysis
                basename = os.path.basename(analysis.filename)
                if basename != analysis.filename:
                    results[basename] = analysis

        # Add fallback analysis for any files not in results
        for f in files:
            # Check both relative path and basename
            if f.relative_path not in results and f.name not in results:
                results[f.name] = LLMFileAnalysis(
                    filename=f.name,
                    architectural_role=self._infer_role_from_path(f.relative_path),
                    description=f"File located at {f.relative_path}",
                    category=self._infer_category_from_path(f.relative_path),
                )

        logger.info(f"LLM analysis complete: {len(results)} files analyzed")

        return results


# Singleton instance
_analyzer: Optional[LLMAnalyzer] = None


def get_llm_analyzer() -> LLMAnalyzer:
    """Get or create the LLM analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = LLMAnalyzer()
    return _analyzer
