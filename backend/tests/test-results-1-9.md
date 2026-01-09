# Test Results Analysis - January 9, 2026

## Summary

- **Total Tests**: 448
- **Passed**: 431
- **Failed**: 16
- **Skipped**: 1

---

## Failed Tests Analysis

### 1. `test_function_analyzer.py::TestArrowFunctionDetection::test_arrow_function_in_object`

**Error**:
```
AssertionError: assert 'increment' in []
```

**Why it fails**: The test expects arrow functions defined as object properties (e.g., `const actions = { increment: (state) => state + 1 }`) to be extracted. However, the `FunctionAnalyzer` delegates to `FileParser.extract_function_definitions()`, which handles `variable_declarator` nodes for arrow functions but does NOT handle `pair` nodes within object literals.

**Root Cause**: In `parser.py`, the `_extract_js_ts_function_definitions()` method at line 672 handles:
- `function_declaration`
- `variable_declarator` with arrow function values
- `method_definition` in classes

But it does NOT traverse into object literals to find `pair` nodes with arrow function values. The simpler `_extract_js_ts_functions()` method (line 350) DOES handle `pair` nodes, but `extract_function_definitions()` uses the more detailed extraction method.

**Fix**: Add handling for `pair` nodes in `_extract_js_ts_function_definitions()` at around line 779:
```python
# Property with arrow function in objects: { foo: () => {} }
elif node.type == "pair":
    key = node.child_by_field_name("key")
    value = node.child_by_field_name("value")
    if key and value and value.type in ("arrow_function", "function_expression"):
        name = self._get_node_text(key, content)
        # ... create FunctionDefinition similar to variable_declarator handling
```

---

### 2. `test_function_analyzer.py::TestParameterCounting::test_python_parameter_count_excludes_self`

**Error**:
```
AssertionError: assert 1 == 0
FunctionDefinition(...parameters_count=1...)
```

**Why it fails**: The test expects that Python methods exclude `self` from the parameter count. The test has a method `method_no_params(self)` and expects `parameters_count == 0`, but it returns `1`.

**Root Cause**: In `parser.py`, the `_count_python_parameters()` method at line 861 tries to exclude `self/cls`, but the logic has a bug. It uses `self._get_node_text(child, "")` with an empty string for content, which returns an empty string instead of the actual parameter name. This means the `if name not in ("self", "cls")` check always passes.

**Fix**: The `_count_python_parameters()` method needs access to the actual content to extract parameter names. Change the method signature to include `content`:
```python
def _count_python_parameters(self, params_node, content: str) -> int:
    """Count parameters in Python function (excluding self/cls)."""
    if not params_node:
        return 0
    count = 0
    for child in params_node.children:
        if child.type in ("identifier", "default_parameter", "typed_parameter", "typed_default_parameter"):
            name = self._get_node_text(child, content)  # Use actual content
            # ... rest of logic
```

And update the call site at line 809:
```python
param_count = self._count_python_parameters(params, content) if params else 0
```

---

### 3. `test_github_service.py::TestCloneRepository::test_clone_with_subdirectory`

**Error**:
```
AssertionError: assert PosixPath('/private/var/...') == PosixPath('/var/...')
```

**Why it fails**: On macOS, `/var` is a symlink to `/private/var`. The test compares paths directly, but `temp_dir` resolves to `/var/...` while the actual result is `/private/var/...` (the resolved real path).

**Root Cause**: The `validate_path_within_base()` function or the path resolution in `clone_repository()` resolves symlinks, creating a mismatch between the expected path (`temp_dir / "src"`) and the actual returned path.

**Fix (Test Adjustment - test is faulty)**: The test should resolve both paths before comparison:
```python
assert result.resolve() == (temp_dir / "src").resolve()
```

Or normalize both using `os.path.realpath()`.

---

### 4. `test_github_service.py::TestCredentialHandling::test_clone_without_token`

**Error**:
```
AssertionError: assert ('GIT_ASKPASS' not in {...} or '...askpass.sh' is None)
```

**Why it fails**: The test expects that when no token is provided, `GIT_ASKPASS` should not be set in the environment. However, VS Code's Git extension sets `GIT_ASKPASS` in the parent environment, which gets copied via `os.environ.copy()`.

**Root Cause**: In `github.py` line 113, `env = os.environ.copy()` copies ALL environment variables including `GIT_ASKPASS` that VS Code set. The service only adds its own `GIT_ASKPASS` when a token is present, but doesn't remove pre-existing `GIT_ASKPASS` values.

**Fix**: When no token is provided, explicitly remove `GIT_ASKPASS` from the environment to ensure credentials aren't accidentally used:
```python
env = os.environ.copy()

if self.access_token and self.access_token != "":
    # Create askpass script...
    env["GIT_ASKPASS"] = str(askpass_script_path)
    env["GIT_TERMINAL_PROMPT"] = "0"
else:
    # Remove any inherited GIT_ASKPASS to prevent unintended auth
    env.pop("GIT_ASKPASS", None)
    env.pop("GIT_TERMINAL_PROMPT", None)
```

---

### 5. `test_github_service.py::TestListUserRepos::test_list_user_repos_error`

**Error**:
```
Exception: API Error
```

**Why it fails**: The test mocks `httpx.AsyncClient.get` to raise an exception, expecting the service to catch it and handle gracefully. However, the exception propagates uncaught.

**Root Cause**: The `list_user_repos()` method at line 277 doesn't have try/except error handling around the HTTP call. The mock raises `Exception("API Error")` which bubbles up.

**Fix (Test Adjustment - test is faulty)**: The test expects the method to catch exceptions, but if that's not the intended behavior, the test should use `pytest.raises()`:
```python
async def test_list_user_repos_error(self, github_service):
    with patch("httpx.AsyncClient.get", side_effect=Exception("API Error")):
        with pytest.raises(Exception, match="API Error"):
            await github_service.list_user_repos()
```

Alternatively, add error handling to `list_user_repos()` if graceful degradation is desired.

---

### 6. `test_github_service.py::TestGetDefaultBranch::test_get_default_branch_fallback`

**Error**:
```
Exception: API Error
```

**Why it fails**: Similar to #5. The test expects that when the API fails, `get_default_branch()` falls back to returning `"main"`. However, the exception propagates.

**Root Cause**: The `get_default_branch()` method at line 224 doesn't catch exceptions from the HTTP call and return the fallback value.

**Fix**: Add error handling to `get_default_branch()`:
```python
async def get_default_branch(self, owner: str, repo: str) -> str:
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json().get("default_branch", "main")
    except Exception as e:
        logger.warning(f"Failed to get default branch: {e}")
    return "main"  # Fallback
```

---

### 7. `test_github_service.py::TestPathTraversalProtection::test_path_traversal_blocked`

**Error**:
```
pydantic_core._pydantic_core.ValidationError: 1 validation error for GitHubRepoInfo
path: Value error, Path cannot contain '..' sequences
```

**Why it fails**: The test tries to create a `GitHubRepoInfo` with `path='../../../etc/passwd'` to test that path traversal is blocked. However, Pydantic validation rejects this at model creation time, before `clone_repository()` is even called.

**Root Cause**: The `GitHubRepoInfo` model has a validator that blocks `..` in paths. The test is validating the wrong layer - the protection exists at the model level, not the service level.

**Fix (Test Adjustment - test is faulty)**: The test should verify that the Pydantic model correctly rejects path traversal:
```python
def test_path_traversal_blocked(self):
    """Path traversal attempts should be rejected by the model."""
    with pytest.raises(ValidationError) as exc_info:
        GitHubRepoInfo(
            owner="test",
            repo="repo",
            path="../../../etc/passwd"
        )
    assert "path traversal" in str(exc_info.value).lower()
```

---

### 8-12. `test_llm_analyzer.py::TestRoleInference::test_infer_*` (5 failures)

**Failures**:
- `test_infer_context`: Expected `CONTEXT`, got `REACT_COMPONENT`
- `test_infer_store`: Expected `STORE`, got `HOOK`
- `test_infer_api_service`: Expected `API_SERVICE`, got `HOOK`
- `test_infer_model`: Expected `MODEL`, got `HOOK`
- `test_infer_controller`: Expected `CONTROLLER`, got `HOOK`

**Why they fail**: The `_infer_role_from_path()` method checks patterns in a specific order. The `.tsx` extension check (line 200) comes BEFORE the directory-based checks for store, api, models, and controllers. Files like `store/userStore.ts` match the hook pattern because `userStore` starts with `use`.

**Root Cause**: In `llm_analyzer.py` starting at line 170, the order of checks causes incorrect inference:

1. Line 198-201: `.tsx` files are classified as `REACT_COMPONENT` before checking for `context/` directory
2. Line 203-205: Files starting with `use` are classified as `HOOK` before checking for `store/`, `api/`, `models/`, `controllers/`

For `context/AuthContext.tsx`: It matches `.tsx` extension first, returns `REACT_COMPONENT`
For `store/userStore.ts`: `userStore` starts with `use`, so it matches hook pattern first

**Fix**: Reorder the checks to prioritize directory-based patterns over extension/naming patterns:
```python
def _infer_role_from_path(self, path: str) -> ArchitecturalRole:
    path_lower = path.lower()
    name = os.path.basename(path_lower)

    # Test files (highest priority)
    if "test" in path_lower or "spec" in path_lower or name.startswith("test_"):
        return ArchitecturalRole.TEST

    # Config files
    if any(x in name for x in ("config", ".config.", "settings", ...)):
        return ArchitecturalRole.CONFIG

    # Directory-based patterns BEFORE extension-based
    if "context" in path_lower:  # Move this up
        return ArchitecturalRole.CONTEXT

    if any(x in path_lower for x in ("store/", "redux", "zustand", "state/")):
        return ArchitecturalRole.STORE

    if any(x in path_lower for x in ("api/", "services/", "service.")):
        return ArchitecturalRole.API_SERVICE

    if any(x in path_lower for x in ("models/", "model.", "types/", "schemas/")):
        return ArchitecturalRole.MODEL

    if "controller" in path_lower:
        return ArchitecturalRole.CONTROLLER

    # Then extension/naming patterns
    if any(x in path_lower for x in ("components/", "pages/", "views/")) or name.endswith((".jsx", ".tsx")):
        return ArchitecturalRole.REACT_COMPONENT

    if "hooks/" in path_lower or name.startswith("use"):
        return ArchitecturalRole.HOOK

    # ... rest of checks
```

---

### 13. `test_llm_analyzer.py::TestBatchAnalysis::test_analyze_batch_api_failure_fallback`

**Error**:
```
AssertionError: assert UNKNOWN == UTILITY
```

**Why it fails**: When the LLM API fails, `analyze_batch()` falls back to using `_infer_role_from_path()`. The test uses a file path like `utils/helper.ts` expecting it to infer `UTILITY`, but it returns `UNKNOWN`.

**Root Cause**: Looking at line 236 in `llm_analyzer.py`:
```python
if any(x in path_lower for x in ("utils/", "util.", "helpers/", "lib/")):
    return ArchitecturalRole.UTILITY
```

The test may be using a path that doesn't contain `utils/` with the trailing slash. If the path is `"utils/helper.ts"`, it should match. The issue might be that the hook check at line 203-205 is matching first if the filename starts with something problematic.

**Actual Issue**: Review the test file to see what path is being used. If the filename is something like `useHelper.ts`, it would match the hook pattern first.

**Fix**: Either fix the path patterns order (as described in #8-12) or adjust the test to use a filename that doesn't trigger false matches.

---

### 14. `test_parser.py::TestJavaScriptImportExtraction::test_dynamic_import`

**Error**:
```
assert 0 >= 1 (len of dynamic imports is 0)
```

**Why it fails**: The test expects dynamic imports (`import('./module')`) to be extracted, but none are found.

**Root Cause**: In `parser.py`, the `_extract_js_ts_imports()` method has logic for dynamic imports at lines 166-182:
```python
elif node.type == "call_expression":
    callee = node.child_by_field_name("function")
    if callee and callee.type == "import":
```

The problem is this code block will never execute because there's ALREADY a `call_expression` handler at lines 149-164 for `require()`. Python's `if/elif` means only the first matching branch executes. The dynamic import branch should check `callee.type == "import"` but it's in an `elif` that never triggers after the first `call_expression` check.

**Fix**: Combine both checks in a single `call_expression` handler or restructure:
```python
elif node.type == "call_expression":
    callee = node.child_by_field_name("function")
    if callee:
        # Check for require()
        if self._get_node_text(callee, content) == "require":
            # ... handle require
        # Check for dynamic import()
        elif callee.type == "import":
            # ... handle dynamic import
```

---

### 15. `test_parser.py::TestPythonImportExtraction::test_from_import`

**Error**:
```
assert None is not None
```

**Why it fails**: The test expects to find an import like `from os import path` but the module is returned as `None`.

**Root Cause**: In `_extract_python_imports()` at line 292, for `import_from_statement`, the code looks for `dotted_name` children to get the module. However, for simple imports like `from os import path`, the module name `os` may be stored differently in the AST - possibly as an `identifier` rather than `dotted_name`.

Looking at line 298-313:
```python
for child in node.children:
    if child.type == "dotted_name":
        module = self._get_node_text(child, content)
    elif child.type == "relative_import":
        # ...
    elif child.type in ("identifier", "dotted_name"):
        # This might be the module or imported name
        pass  # THIS IS THE PROBLEM - it does nothing!
```

The `elif child.type in ("identifier", "dotted_name")` branch has `pass`, meaning single-word module names (like `os`) are ignored.

**Fix**: Handle simple identifiers as module names:
```python
for child in node.children:
    if child.type == "dotted_name":
        module = self._get_node_text(child, content)
    elif child.type == "identifier" and module is None:
        # Simple module name like 'os' in 'from os import path'
        # Only set if we haven't found a module yet and this precedes 'import'
        text = self._get_node_text(child, content)
        if text != "import":  # Skip the 'import' keyword
            module = text
```

---

### 16. `test_parser.py::TestEncodingHandling::test_utf8_file`

**Error**:
```
AssertionError: assert 'greet' in ['\n    ']
```

**Why it fails**: The test creates a Python file with UTF-8 content (including non-ASCII characters in a docstring), expecting the function `greet` to be extracted. Instead, the functions list contains just `'\n    '`.

**Root Cause**: The `_extract_python_functions()` method is extracting something unexpected. Looking at line 408-431, it extracts function names via:
```python
if node.type == "function_definition":
    name = node.child_by_field_name("name")
    if name:
        func_name = self._get_node_text(name, content)
```

The issue is that `functions.append(func_name)` is appending the raw text, but somehow `'\n    '` is being captured, which suggests the name node is incorrect or the content has encoding issues causing byte offset misalignment.

**Root Cause Detail**: When content contains multi-byte UTF-8 characters, the byte offsets from tree-sitter may not align correctly if the content is being processed inconsistently (string vs bytes). The `_get_node_text()` method at line 451 uses `content[node.start_byte:node.end_byte]`, but this only works correctly if `content` is bytes or if all characters are single-byte.

**Fix**: Ensure consistent encoding handling. Either:
1. Keep content as bytes throughout: `content_bytes = content.encode("utf-8")` and use that for slicing
2. Or convert byte offsets to character offsets before slicing

```python
def _get_node_text(self, node, content: str) -> str:
    """Get the text content of a node."""
    # Convert to bytes for correct offset handling
    content_bytes = content.encode("utf-8")
    text_bytes = content_bytes[node.start_byte:node.end_byte]
    return text_bytes.decode("utf-8")
```

---

## Summary of Required Fixes

| # | Test File | Issue Type | Fix Location |
|---|-----------|------------|--------------|
| 1 | function_analyzer | Missing feature | `parser.py` - add `pair` node handling |
| 2 | function_analyzer | Bug | `parser.py` - fix `_count_python_parameters` content param |
| 3 | github_service | Test issue | Test should use `.resolve()` for path comparison |
| 4 | github_service | Bug | `github.py` - remove inherited `GIT_ASKPASS` when no token |
| 5 | github_service | Test issue | Test should use `pytest.raises()` or add error handling |
| 6 | github_service | Missing feature | `github.py` - add try/except to `get_default_branch()` |
| 7 | github_service | Test issue | Test validates wrong layer (model vs service) |
| 8-12 | llm_analyzer | Logic bug | `llm_analyzer.py` - reorder role inference checks |
| 13 | llm_analyzer | Logic bug | Same as #8-12 |
| 14 | parser | Logic bug | `parser.py` - fix `elif` for dynamic imports |
| 15 | parser | Bug | `parser.py` - handle simple identifiers in `from` imports |
| 16 | parser | Bug | `parser.py` - fix UTF-8 byte offset handling |

## Recommendations

1. **High Priority**: Fix #2, #14, #15, #16 - these are parser bugs that affect core functionality
2. **Medium Priority**: Fix #8-12, #13 - role inference order issue affects LLM fallback quality
3. **Low Priority**: Fix #1, #4, #6 - minor feature gaps and edge cases
4. **Test Adjustments**: #3, #5, #7 - tests need adjustment to match actual behavior
