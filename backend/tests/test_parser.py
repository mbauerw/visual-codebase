"""
Tests for the FileParser service.
Covers JavaScript/TypeScript and Python import extraction, export detection,
function/class extraction, encoding handling, file size limits, and error cases.
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.services.parser import FileParser, get_parser
from app.models.schemas import (
    ImportInfo,
    ImportType,
    Language,
    ParsedFile,
)


# ==================== Fixtures ====================

@pytest.fixture
def parser():
    """Create a fresh FileParser instance for each test."""
    return FileParser()


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


def create_temp_file(temp_dir: str, filename: str, content: str) -> str:
    """Helper to create a temporary file with given content."""
    file_path = os.path.join(temp_dir, filename)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return file_path


# ==================== Language Detection Tests ====================

class TestLanguageDetection:
    """Tests for language detection from file extensions."""

    def test_detect_javascript(self, parser):
        """Test JavaScript file detection."""
        assert parser.detect_language("app.js") == Language.JAVASCRIPT
        assert parser.detect_language("component.jsx") == Language.JAVASCRIPT

    def test_detect_typescript(self, parser):
        """Test TypeScript file detection."""
        assert parser.detect_language("app.ts") == Language.TYPESCRIPT
        assert parser.detect_language("component.tsx") == Language.TYPESCRIPT

    def test_detect_python(self, parser):
        """Test Python file detection."""
        assert parser.detect_language("main.py") == Language.PYTHON

    def test_detect_unknown(self, parser):
        """Test unknown file type detection."""
        assert parser.detect_language("file.java") == Language.UNKNOWN
        assert parser.detect_language("file.cpp") == Language.UNKNOWN
        assert parser.detect_language("file.txt") == Language.UNKNOWN
        assert parser.detect_language("file") == Language.UNKNOWN

    def test_case_insensitive_extension(self, parser):
        """Test that extension detection is case-insensitive."""
        assert parser.detect_language("app.JS") == Language.JAVASCRIPT
        assert parser.detect_language("app.TS") == Language.TYPESCRIPT
        assert parser.detect_language("app.PY") == Language.PYTHON


# ==================== JavaScript/TypeScript Import Tests ====================

class TestJavaScriptImportExtraction:
    """Tests for JavaScript/TypeScript import extraction."""

    def test_es6_import_default(self, parser, temp_dir):
        """Test default import extraction."""
        content = '''
import React from 'react';
import App from './App';
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

        react_import = next((i for i in result.imports if i.module == "react"), None)
        assert react_import is not None
        assert react_import.import_type == ImportType.IMPORT
        assert react_import.is_relative is False

        app_import = next((i for i in result.imports if i.module == "./App"), None)
        assert app_import is not None
        assert app_import.is_relative is True

    def test_es6_import_named(self, parser, temp_dir):
        """Test named import extraction."""
        content = '''
import { useState, useEffect } from 'react';
import { formatDate, parseDate } from './utils/date';
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

        react_import = next((i for i in result.imports if i.module == "react"), None)
        assert react_import is not None
        assert "useState" in react_import.imported_names
        assert "useEffect" in react_import.imported_names

    def test_es6_import_namespace(self, parser, temp_dir):
        """Test namespace import extraction."""
        content = '''
import * as React from 'react';
import * as utils from './utils';
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

    def test_es6_import_mixed(self, parser, temp_dir):
        """Test mixed import styles."""
        content = '''
import React, { useState, useEffect } from 'react';
import axios from 'axios';
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

    def test_require_import(self, parser, temp_dir):
        """Test CommonJS require extraction."""
        content = '''
const express = require('express');
const router = require('./routes/api');
const { readFile } = require('fs');
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Should detect require calls
        require_imports = [i for i in result.imports if i.import_type == ImportType.REQUIRE]
        assert len(require_imports) >= 2

    def test_dynamic_import(self, parser, temp_dir):
        """Test dynamic import() extraction."""
        content = '''
const module = await import('./dynamicModule');
import('./lazyComponent').then(m => m.default);
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        dynamic_imports = [i for i in result.imports if i.import_type == ImportType.DYNAMIC_IMPORT]
        assert len(dynamic_imports) >= 1

    def test_typescript_type_imports(self, parser, temp_dir):
        """Test TypeScript type imports."""
        content = '''
import type { User, Profile } from './types';
import { type Config, createConfig } from './config';
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) >= 1

    def test_path_aliases(self, parser, temp_dir):
        """Test recognition of path aliases."""
        content = '''
import { Button } from '@/components/Button';
import { utils } from '~/lib/utils';
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        alias_imports = [i for i in result.imports if i.module.startswith("@/") or i.module.startswith("~/")]
        assert len(alias_imports) == 2


# ==================== Python Import Tests ====================

class TestPythonImportExtraction:
    """Tests for Python import extraction."""

    def test_simple_import(self, parser, temp_dir):
        """Test simple import statement."""
        content = '''
import os
import sys
import json
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        modules = [i.module for i in result.imports]
        assert "os" in modules
        assert "sys" in modules
        assert "json" in modules

    def test_from_import(self, parser, temp_dir):
        """Test from ... import statement."""
        content = '''
from os import path, getcwd
from typing import List, Dict, Optional
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

        os_import = next((i for i in result.imports if i.module == "os"), None)
        assert os_import is not None
        assert os_import.import_type == ImportType.FROM_IMPORT

    def test_relative_import(self, parser, temp_dir):
        """Test relative imports in Python."""
        content = '''
from . import utils
from .. import models
from .helpers import process_data
from ..services.api import fetch
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        relative_imports = [i for i in result.imports if i.is_relative]
        assert len(relative_imports) >= 2

    def test_aliased_import(self, parser, temp_dir):
        """Test aliased imports."""
        content = '''
import numpy as np
import pandas as pd
from datetime import datetime as dt
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) >= 2

    def test_dotted_import(self, parser, temp_dir):
        """Test dotted module imports."""
        content = '''
import os.path
import urllib.parse
from xml.etree import ElementTree
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) >= 2


# ==================== Export Detection Tests ====================

class TestExportDetection:
    """Tests for JavaScript/TypeScript export detection."""

    def test_named_export(self, parser, temp_dir):
        """Test named export detection."""
        content = '''
export const foo = 'bar';
export function helper() {}
export class MyClass {}
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "helper" in result.exports
        assert "MyClass" in result.exports

    def test_default_export(self, parser, temp_dir):
        """Test default export detection."""
        content = '''
const Component = () => <div />;
export default Component;
'''
        file_path = create_temp_file(temp_dir, "test.tsx", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "Component" in result.exports

    def test_export_function_declaration(self, parser, temp_dir):
        """Test export function declaration."""
        content = '''
export function processData(data) {
    return data.map(x => x * 2);
}

export async function fetchData() {
    return await fetch('/api');
}
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "processData" in result.exports
        assert "fetchData" in result.exports

    def test_export_class_declaration(self, parser, temp_dir):
        """Test export class declaration."""
        content = '''
export class UserService {
    constructor() {}
    getUser() {}
}
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserService" in result.exports


# ==================== Function Extraction Tests ====================

class TestFunctionExtraction:
    """Tests for function and method extraction."""

    def test_js_function_declaration(self, parser, temp_dir):
        """Test JavaScript function declaration extraction."""
        content = '''
function processData(data) {
    return data;
}

async function fetchUser(id) {
    return await api.get(id);
}
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "processData" in result.functions
        assert "fetchUser" in result.functions

    def test_js_arrow_function(self, parser, temp_dir):
        """Test arrow function extraction."""
        content = '''
const handleClick = () => {
    console.log('clicked');
};

const processItem = (item) => item * 2;
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "handleClick" in result.functions
        assert "processItem" in result.functions

    def test_js_method_extraction(self, parser, temp_dir):
        """Test class method extraction."""
        content = '''
class UserController {
    constructor(service) {
        this.service = service;
    }

    async getUser(id) {
        return this.service.find(id);
    }

    updateUser(id, data) {
        return this.service.update(id, data);
    }
}
'''
        file_path = create_temp_file(temp_dir, "test.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "getUser" in result.functions
        assert "updateUser" in result.functions

    def test_python_function_extraction(self, parser, temp_dir):
        """Test Python function extraction."""
        content = '''
def process_data(data):
    return [x * 2 for x in data]

async def fetch_user(user_id):
    return await db.get(user_id)

def _private_helper():
    pass
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "process_data" in result.functions
        assert "fetch_user" in result.functions
        assert "_private_helper" in result.functions

    def test_python_method_extraction(self, parser, temp_dir):
        """Test Python class method extraction."""
        content = '''
class UserService:
    def __init__(self, db):
        self.db = db

    def get_user(self, user_id):
        return self.db.find(user_id)

    async def update_user(self, user_id, data):
        return await self.db.update(user_id, data)

    def __str__(self):
        return "UserService"
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # __init__ should be included, but __str__ should be skipped (dunder except __init__)
        assert "__init__" in result.functions
        assert "get_user" in result.functions
        assert "update_user" in result.functions


# ==================== Class Extraction Tests ====================

class TestClassExtraction:
    """Tests for class extraction."""

    def test_js_class_extraction(self, parser, temp_dir):
        """Test JavaScript class extraction."""
        content = '''
class UserController {
    constructor() {}
}

class ApiService extends BaseService {
    fetch() {}
}
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserController" in result.classes
        assert "ApiService" in result.classes

    def test_python_class_extraction(self, parser, temp_dir):
        """Test Python class extraction."""
        content = '''
class User:
    pass

class UserService(BaseService):
    def __init__(self):
        super().__init__()
'''
        file_path = create_temp_file(temp_dir, "test.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "User" in result.classes
        assert "UserService" in result.classes


# ==================== File Size Limit Tests ====================

class TestFileSizeLimits:
    """Tests for file size limit handling."""

    def test_file_under_limit(self, parser, temp_dir):
        """Test that files under the size limit are parsed."""
        content = "x = 1\n" * 100  # Small file
        file_path = create_temp_file(temp_dir, "small.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None

    def test_file_over_limit(self, parser, temp_dir):
        """Test that files over the size limit are skipped."""
        # Create a file larger than 100KB
        content = "x = 1\n" * 50000  # ~300KB
        file_path = create_temp_file(temp_dir, "large.py", content)

        with patch.object(parser.settings, 'max_file_size_bytes', 1000):
            result = parser.parse_file(file_path, temp_dir)

        assert result is None


# ==================== Unsupported File Types ====================

class TestUnsupportedFileTypes:
    """Tests for unsupported file type handling."""

    def test_unsupported_extension(self, parser, temp_dir):
        """Test that unsupported file types return None."""
        content = "public class Main { }"
        file_path = create_temp_file(temp_dir, "Main.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is None

    def test_no_extension(self, parser, temp_dir):
        """Test files without extension."""
        content = "#!/bin/bash\necho hello"
        file_path = create_temp_file(temp_dir, "script", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is None


# ==================== Malformed Syntax Handling ====================

class TestMalformedSyntax:
    """Tests for handling malformed syntax."""

    def test_js_syntax_error(self, parser, temp_dir):
        """Test JavaScript with syntax errors still parses partially."""
        content = '''
import React from 'react';
const x = {
    // Missing closing brace
'''
        file_path = create_temp_file(temp_dir, "broken.js", content)
        result = parser.parse_file(file_path, temp_dir)

        # Tree-sitter is error-tolerant, should still extract what it can
        assert result is not None
        # Should still detect the import
        assert len(result.imports) >= 1

    def test_python_syntax_error(self, parser, temp_dir):
        """Test Python with syntax errors still parses partially."""
        content = '''
import os

def broken_function(
    # Missing closing parenthesis
'''
        file_path = create_temp_file(temp_dir, "broken.py", content)
        result = parser.parse_file(file_path, temp_dir)

        # Tree-sitter is error-tolerant
        assert result is not None


# ==================== Encoding Tests ====================

class TestEncodingHandling:
    """Tests for different file encodings."""

    def test_utf8_file(self, parser, temp_dir):
        """Test UTF-8 encoded file."""
        content = '''
# Comment with unicode: 你好世界
def greet():
    return "Hello 世界"
'''
        file_path = create_temp_file(temp_dir, "unicode.py", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "greet" in result.functions

    def test_file_with_special_chars(self, parser, temp_dir):
        """Test file with special characters in strings."""
        content = '''
const emoji = "🚀 Launch!";
const special = "Café résumé naïve";
'''
        file_path = create_temp_file(temp_dir, "special.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None


# ==================== Directory Walking Tests ====================

class TestDirectoryWalking:
    """Tests for directory traversal functionality."""

    def test_walk_directory(self, parser, temp_dir):
        """Test walking a directory for source files."""
        # Create nested structure
        create_temp_file(temp_dir, "src/index.ts", "export const x = 1;")
        create_temp_file(temp_dir, "src/utils/helpers.ts", "export function help() {}")
        create_temp_file(temp_dir, "src/components/Button.tsx", "export const Button = () => {};")
        create_temp_file(temp_dir, "README.md", "# Readme")  # Should be ignored

        files = parser.walk_directory(temp_dir)

        assert len(files) == 3
        assert any("index.ts" in f for f in files)
        assert any("helpers.ts" in f for f in files)
        assert any("Button.tsx" in f for f in files)
        assert not any("README.md" in f for f in files)

    def test_skip_node_modules(self, parser, temp_dir):
        """Test that node_modules is skipped by default."""
        create_temp_file(temp_dir, "src/index.js", "const x = 1;")
        create_temp_file(temp_dir, "node_modules/lodash/index.js", "module.exports = {};")

        files = parser.walk_directory(temp_dir, include_node_modules=False)

        assert len(files) == 1
        assert not any("node_modules" in f for f in files)

    def test_include_node_modules(self, parser, temp_dir):
        """Test including node_modules when requested."""
        create_temp_file(temp_dir, "src/index.js", "const x = 1;")
        create_temp_file(temp_dir, "node_modules/lodash/index.js", "module.exports = {};")

        files = parser.walk_directory(temp_dir, include_node_modules=True)

        assert len(files) == 2
        assert any("node_modules" in f for f in files)

    def test_max_depth(self, parser, temp_dir):
        """Test max depth limit."""
        create_temp_file(temp_dir, "level1.js", "const x = 1;")
        create_temp_file(temp_dir, "a/level2.js", "const x = 2;")
        create_temp_file(temp_dir, "a/b/level3.js", "const x = 3;")
        create_temp_file(temp_dir, "a/b/c/level4.js", "const x = 4;")

        files = parser.walk_directory(temp_dir, max_depth=2)

        # Should only find files up to depth 2
        assert any("level1.js" in f for f in files)
        assert any("level2.js" in f for f in files)
        # level3 and level4 should be excluded
        file_names = [os.path.basename(f) for f in files]
        assert "level3.js" not in file_names
        assert "level4.js" not in file_names

    def test_skip_hidden_directories(self, parser, temp_dir):
        """Test that .git and other hidden directories are skipped."""
        create_temp_file(temp_dir, "src/index.js", "const x = 1;")
        create_temp_file(temp_dir, ".git/objects/pack.js", "const x = 2;")
        create_temp_file(temp_dir, "__pycache__/module.py", "x = 1")

        files = parser.walk_directory(temp_dir)

        assert len(files) == 1
        assert not any(".git" in f for f in files)
        assert not any("__pycache__" in f for f in files)


# ==================== Parse Directory Tests ====================

class TestParseDirectory:
    """Tests for parsing an entire directory."""

    def test_parse_directory(self, parser, temp_dir):
        """Test parsing all files in a directory."""
        create_temp_file(temp_dir, "src/index.ts", '''
import { helper } from './utils';
export const main = () => helper();
''')
        create_temp_file(temp_dir, "src/utils.ts", '''
export function helper() {
    return 'help';
}
''')

        results = parser.parse_directory(temp_dir)

        assert len(results) == 2
        assert all(isinstance(r, ParsedFile) for r in results)

    def test_parse_directory_with_content(self, parser, temp_dir):
        """Test parsing with content inclusion."""
        content = "const x = 1;"
        create_temp_file(temp_dir, "test.js", content)

        results = parser.parse_directory(temp_dir, include_content=True)

        assert len(results) == 1
        assert results[0].content == content

    def test_parse_directory_without_content(self, parser, temp_dir):
        """Test parsing without content inclusion."""
        create_temp_file(temp_dir, "test.js", "const x = 1;")

        results = parser.parse_directory(temp_dir, include_content=False)

        assert len(results) == 1
        assert results[0].content is None


# ==================== Singleton Pattern Tests ====================

class TestSingletonPattern:
    """Tests for the singleton pattern."""

    def test_get_parser_returns_same_instance(self):
        """Test that get_parser returns the same instance."""
        parser1 = get_parser()
        parser2 = get_parser()

        assert parser1 is parser2

    def test_parser_attributes_persist(self):
        """Test that parser attributes persist across calls."""
        parser = get_parser()
        # Access some attribute to ensure initialization
        assert parser.js_language is not None
        assert parser.py_language is not None


# ==================== React Hook Detection Tests ====================

class TestReactHookDetection:
    """Tests for React hook detection."""

    def test_custom_hook_detection(self, parser, temp_dir):
        """Test that custom hooks are detected."""
        content = '''
import { useState, useEffect } from 'react';

export function useCustomHook() {
    const [state, setState] = useState(null);
    useEffect(() => {
        // effect
    }, []);
    return state;
}

const useAnotherHook = () => {
    return useState(0);
};
'''
        file_path = create_temp_file(temp_dir, "useCustomHook.ts", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "useCustomHook" in result.functions
        assert "useAnotherHook" in result.functions


# ==================== Edge Cases ====================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_file(self, parser, temp_dir):
        """Test parsing an empty file."""
        file_path = create_temp_file(temp_dir, "empty.js", "")
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 0
        assert len(result.functions) == 0

    def test_comments_only_file(self, parser, temp_dir):
        """Test file with only comments."""
        content = '''
// This is a comment
/* Block comment */
/**
 * JSDoc comment
 */
'''
        file_path = create_temp_file(temp_dir, "comments.js", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 0

    def test_nonexistent_file(self, parser, temp_dir):
        """Test parsing a file that doesn't exist."""
        result = parser.parse_file("/nonexistent/file.js", temp_dir)
        assert result is None

    def test_file_path_metadata(self, parser, temp_dir):
        """Test that file path metadata is correctly set."""
        create_temp_file(temp_dir, "src/utils/helpers.ts", "export const x = 1;")
        file_path = os.path.join(temp_dir, "src/utils/helpers.ts")

        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.name == "helpers.ts"
        assert result.folder == "src/utils"
        assert result.relative_path == "src/utils/helpers.ts"
        assert result.language == Language.TYPESCRIPT

    def test_line_count(self, parser, temp_dir):
        """Test that line count is correctly calculated."""
        content = "line1\nline2\nline3\nline4\nline5"
        file_path = create_temp_file(temp_dir, "lines.js", content)

        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.line_count == 5

    def test_file_size_bytes(self, parser, temp_dir):
        """Test that file size is correctly calculated."""
        content = "x" * 100
        file_path = create_temp_file(temp_dir, "size.js", content)

        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.size_bytes == 100
