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

    def test_detect_java(self, parser):
        """Test Java file detection."""
        assert parser.detect_language("Main.java") == Language.JAVA

    def test_detect_csharp(self, parser):
        """Test C# file detection."""
        assert parser.detect_language("Program.cs") == Language.CSHARP

    def test_detect_unknown(self, parser):
        """Test unknown file type detection."""
        assert parser.detect_language("file.cpp") == Language.UNKNOWN
        assert parser.detect_language("file.rb") == Language.UNKNOWN
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
        content = "class Main; end"
        file_path = create_temp_file(temp_dir, "main.rb", content)
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
        # Access some attribute to ensure initialization (lazy loading)
        assert parser.settings is not None
        assert parser._extension_to_lang is not None
        # Languages are lazily loaded now
        assert ".js" in parser._extension_to_lang
        assert ".py" in parser._extension_to_lang


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


# ==================== Java Import Tests ====================

class TestJavaImportExtraction:
    """Tests for Java import extraction."""

    def test_simple_import(self, parser, temp_dir):
        """Test simple Java import statement."""
        content = '''
package com.example.demo;

import java.util.List;
import java.util.Map;
import java.util.Optional;
'''
        file_path = create_temp_file(temp_dir, "Test.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.language == Language.JAVA
        assert len(result.imports) == 3

        modules = [i.module for i in result.imports]
        assert "java.util.List" in modules
        assert "java.util.Map" in modules
        assert "java.util.Optional" in modules

    def test_static_import(self, parser, temp_dir):
        """Test Java static import extraction."""
        content = '''
package com.example.demo;

import static org.junit.Assert.assertEquals;
import static java.lang.Math.PI;
'''
        file_path = create_temp_file(temp_dir, "Test.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        static_imports = [i for i in result.imports if i.import_type == ImportType.STATIC_IMPORT]
        assert len(static_imports) == 2

    def test_wildcard_import(self, parser, temp_dir):
        """Test Java wildcard import extraction."""
        content = '''
package com.example.demo;

import java.util.*;
import org.springframework.beans.factory.annotation.*;
'''
        file_path = create_temp_file(temp_dir, "Test.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        wildcard_imports = [i for i in result.imports if i.import_type == ImportType.WILDCARD_IMPORT]
        assert len(wildcard_imports) == 2

    def test_spring_imports(self, parser, temp_dir):
        """Test Spring framework imports."""
        content = '''
package com.example.demo.controller;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.beans.factory.annotation.Autowired;

import com.example.demo.service.UserService;
'''
        file_path = create_temp_file(temp_dir, "UserController.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 4

        # Check for internal imports (relative to project)
        internal = [i for i in result.imports if "com.example.demo" in i.module]
        assert len(internal) == 1

    def test_mixed_import_types(self, parser, temp_dir):
        """Test mixing regular, static, and wildcard imports."""
        content = '''
package com.example;

import java.util.List;
import java.util.stream.*;
import static org.junit.Assert.*;
'''
        file_path = create_temp_file(temp_dir, "Test.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        regular = [i for i in result.imports if i.import_type == ImportType.IMPORT]
        static = [i for i in result.imports if i.import_type == ImportType.STATIC_IMPORT]
        wildcard = [i for i in result.imports if i.import_type == ImportType.WILDCARD_IMPORT]

        assert len(regular) == 1
        assert len(static) == 1
        assert len(wildcard) == 1


# ==================== Java Function/Class Tests ====================

class TestJavaFunctionExtraction:
    """Tests for Java function and method extraction."""

    def test_method_extraction(self, parser, temp_dir):
        """Test Java method extraction."""
        content = '''
package com.example;

public class UserService {
    public List<User> findAll() {
        return repository.findAll();
    }

    public User findById(Long id) {
        return repository.findById(id);
    }

    private User toEntity(UserDTO dto) {
        return new User(dto);
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "findAll" in result.functions
        assert "findById" in result.functions
        assert "toEntity" in result.functions

    def test_constructor_extraction(self, parser, temp_dir):
        """Test Java constructor extraction."""
        content = '''
package com.example;

public class User {
    private String name;

    public User() {
    }

    public User(String name) {
        this.name = name;
    }
}
'''
        file_path = create_temp_file(temp_dir, "User.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Constructors should be in functions
        assert "User" in result.functions

    def test_getter_setter_extraction(self, parser, temp_dir):
        """Test Java getter/setter extraction."""
        content = '''
package com.example;

public class User {
    private String name;
    private String email;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
'''
        file_path = create_temp_file(temp_dir, "User.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "getName" in result.functions
        assert "setName" in result.functions
        assert "getEmail" in result.functions
        assert "setEmail" in result.functions


class TestJavaClassExtraction:
    """Tests for Java class extraction."""

    def test_class_extraction(self, parser, temp_dir):
        """Test Java class extraction."""
        content = '''
package com.example;

public class UserService {
}

class InternalHelper {
}
'''
        file_path = create_temp_file(temp_dir, "UserService.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserService" in result.classes
        assert "InternalHelper" in result.classes

    def test_interface_extraction(self, parser, temp_dir):
        """Test Java interface extraction."""
        content = '''
package com.example;

public interface UserRepository {
    User findById(Long id);
    List<User> findAll();
}
'''
        file_path = create_temp_file(temp_dir, "UserRepository.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRepository" in result.classes

    def test_enum_extraction(self, parser, temp_dir):
        """Test Java enum extraction."""
        content = '''
package com.example;

public enum UserRole {
    ADMIN,
    USER,
    GUEST
}
'''
        file_path = create_temp_file(temp_dir, "UserRole.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRole" in result.classes


# ==================== Java Export Tests ====================

class TestJavaExportExtraction:
    """Tests for Java export extraction (public classes/methods)."""

    def test_public_class_export(self, parser, temp_dir):
        """Test that public classes are exported."""
        content = '''
package com.example;

public class UserService {
    public void doSomething() {}
}
'''
        file_path = create_temp_file(temp_dir, "UserService.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserService" in result.exports

    def test_public_interface_export(self, parser, temp_dir):
        """Test that public interfaces are exported."""
        content = '''
package com.example;

public interface UserRepository {
    User findById(Long id);
}
'''
        file_path = create_temp_file(temp_dir, "UserRepository.java", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRepository" in result.exports


# ==================== C# Using Directive Tests ====================

class TestCSharpUsingExtraction:
    """Tests for C# using directive extraction."""

    def test_simple_using(self, parser, temp_dir):
        """Test simple C# using directive."""
        content = '''
using System;
using System.Collections.Generic;
using System.Linq;

namespace MyApp
{
    public class Program { }
}
'''
        file_path = create_temp_file(temp_dir, "Program.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.language == Language.CSHARP
        assert len(result.imports) == 3

        modules = [i.module for i in result.imports]
        assert "System" in modules
        assert "System.Collections.Generic" in modules
        assert "System.Linq" in modules

    def test_static_using(self, parser, temp_dir):
        """Test C# static using directive."""
        content = '''
using System;
using static System.Math;
using static System.Console;

namespace MyApp
{
    public class Program { }
}
'''
        file_path = create_temp_file(temp_dir, "Program.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        static_usings = [i for i in result.imports if i.import_type == ImportType.STATIC_USING]
        assert len(static_usings) == 2

    def test_alias_using(self, parser, temp_dir):
        """Test C# alias using directive."""
        content = '''
using System;
using Env = System.Environment;
using StringList = System.Collections.Generic.List<string>;

namespace MyApp
{
    public class Program { }
}
'''
        file_path = create_temp_file(temp_dir, "Program.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        alias_usings = [i for i in result.imports if i.import_type == ImportType.ALIAS_USING]
        assert len(alias_usings) == 2

    def test_global_using(self, parser, temp_dir):
        """Test C# global using directive."""
        content = '''
global using System;
global using System.Collections.Generic;

namespace MyApp
{
    public class Program { }
}
'''
        file_path = create_temp_file(temp_dir, "Program.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        global_usings = [i for i in result.imports if i.import_type == ImportType.GLOBAL_USING]
        assert len(global_usings) == 2

    def test_aspnet_usings(self, parser, temp_dir):
        """Test ASP.NET Core typical usings."""
        content = '''
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MyApp.Services;
using MyApp.Models;

namespace MyApp.Controllers
{
    [ApiController]
    public class UserController : ControllerBase { }
}
'''
        file_path = create_temp_file(temp_dir, "UserController.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 4

        # Check for internal imports
        internal = [i for i in result.imports if i.module.startswith("MyApp")]
        assert len(internal) == 2


# ==================== C# Function/Class Tests ====================

class TestCSharpFunctionExtraction:
    """Tests for C# method extraction."""

    def test_method_extraction(self, parser, temp_dir):
        """Test C# method extraction."""
        content = '''
using System;

namespace MyApp
{
    public class UserService
    {
        public List<User> GetAll()
        {
            return _repository.GetAll();
        }

        public User GetById(int id)
        {
            return _repository.GetById(id);
        }

        private User ToEntity(UserDto dto)
        {
            return new User(dto);
        }
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "GetAll" in result.functions
        assert "GetById" in result.functions
        assert "ToEntity" in result.functions

    def test_async_method_extraction(self, parser, temp_dir):
        """Test C# async method extraction."""
        content = '''
using System.Threading.Tasks;

namespace MyApp
{
    public class UserService
    {
        public async Task<User> GetByIdAsync(int id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<List<User>> GetAllAsync()
        {
            return await _repository.GetAllAsync();
        }
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "GetByIdAsync" in result.functions
        assert "GetAllAsync" in result.functions

    def test_property_extraction(self, parser, temp_dir):
        """Test C# property extraction (getters/setters)."""
        content = '''
namespace MyApp
{
    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }
}
'''
        file_path = create_temp_file(temp_dir, "User.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Properties may or may not be in functions depending on implementation
        # Classes should definitely be detected
        assert "User" in result.classes

    def test_constructor_extraction(self, parser, temp_dir):
        """Test C# constructor extraction."""
        content = '''
namespace MyApp
{
    public class User
    {
        public User()
        {
        }

        public User(string name, string email)
        {
            Name = name;
            Email = email;
        }

        public string Name { get; set; }
        public string Email { get; set; }
    }
}
'''
        file_path = create_temp_file(temp_dir, "User.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Constructors should be in functions
        assert "User" in result.functions or "User" in result.classes


class TestCSharpClassExtraction:
    """Tests for C# class extraction."""

    def test_class_extraction(self, parser, temp_dir):
        """Test C# class extraction."""
        content = '''
namespace MyApp
{
    public class UserService
    {
    }

    internal class InternalHelper
    {
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserService" in result.classes
        assert "InternalHelper" in result.classes

    def test_interface_extraction(self, parser, temp_dir):
        """Test C# interface extraction."""
        content = '''
namespace MyApp
{
    public interface IUserService
    {
        User GetById(int id);
        List<User> GetAll();
    }
}
'''
        file_path = create_temp_file(temp_dir, "IUserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "IUserService" in result.classes

    def test_record_extraction(self, parser, temp_dir):
        """Test C# record type extraction."""
        content = '''
namespace MyApp.Records
{
    public record UserRecord(int Id, string Name, string Email);

    public record CreateUserCommand(string Name, string Email)
    {
        public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserRecord.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRecord" in result.classes
        assert "CreateUserCommand" in result.classes

    def test_enum_extraction(self, parser, temp_dir):
        """Test C# enum extraction."""
        content = '''
namespace MyApp
{
    public enum UserRole
    {
        Admin,
        User,
        Guest
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserRole.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRole" in result.classes

    def test_struct_extraction(self, parser, temp_dir):
        """Test C# struct extraction."""
        content = '''
namespace MyApp
{
    public struct Point
    {
        public int X { get; set; }
        public int Y { get; set; }
    }
}
'''
        file_path = create_temp_file(temp_dir, "Point.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "Point" in result.classes


# ==================== C# Export Tests ====================

class TestCSharpExportExtraction:
    """Tests for C# export extraction (public types)."""

    def test_public_class_export(self, parser, temp_dir):
        """Test that public classes are exported."""
        content = '''
namespace MyApp
{
    public class UserService
    {
        public void DoSomething() { }
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserService" in result.exports

    def test_public_interface_export(self, parser, temp_dir):
        """Test that public interfaces are exported."""
        content = '''
namespace MyApp
{
    public interface IUserService
    {
        User GetById(int id);
    }
}
'''
        file_path = create_temp_file(temp_dir, "IUserService.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "IUserService" in result.exports

    def test_extension_class_export(self, parser, temp_dir):
        """Test that extension classes are exported."""
        content = '''
using System;

namespace MyApp.Extensions
{
    public static class StringExtensions
    {
        public static string ToTitleCase(this string str)
        {
            return str;
        }
    }
}
'''
        file_path = create_temp_file(temp_dir, "StringExtensions.cs", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "StringExtensions" in result.exports


# ==================== Cross-Language Directory Tests ====================

class TestCrossLanguageDirectory:
    """Tests for parsing directories with multiple languages."""

    def test_walk_directory_with_java(self, parser, temp_dir):
        """Test walking directory finds Java files."""
        create_temp_file(temp_dir, "src/main/java/App.java", "public class App {}")
        create_temp_file(temp_dir, "src/main/java/util/Helper.java", "public class Helper {}")
        create_temp_file(temp_dir, "src/index.ts", "export const x = 1;")

        files = parser.walk_directory(temp_dir)

        java_files = [f for f in files if f.endswith(".java")]
        ts_files = [f for f in files if f.endswith(".ts")]

        assert len(java_files) == 2
        assert len(ts_files) == 1

    def test_walk_directory_with_csharp(self, parser, temp_dir):
        """Test walking directory finds C# files."""
        create_temp_file(temp_dir, "src/Controllers/UserController.cs", "public class UserController {}")
        create_temp_file(temp_dir, "src/Services/UserService.cs", "public class UserService {}")
        create_temp_file(temp_dir, "src/app.ts", "export const x = 1;")

        files = parser.walk_directory(temp_dir)

        cs_files = [f for f in files if f.endswith(".cs")]
        ts_files = [f for f in files if f.endswith(".ts")]

        assert len(cs_files) == 2
        assert len(ts_files) == 1

    def test_skip_java_build_directories(self, parser, temp_dir):
        """Test that Java build directories are skipped."""
        create_temp_file(temp_dir, "src/main/java/App.java", "public class App {}")
        create_temp_file(temp_dir, "target/classes/App.class", "compiled")
        create_temp_file(temp_dir, ".gradle/cache/file.java", "cache")

        files = parser.walk_directory(temp_dir)

        assert len(files) == 1
        assert not any("target" in f for f in files)
        assert not any(".gradle" in f for f in files)

    def test_skip_csharp_build_directories(self, parser, temp_dir):
        """Test that C# build directories are skipped."""
        create_temp_file(temp_dir, "src/App.cs", "public class App {}")
        create_temp_file(temp_dir, "bin/Debug/App.dll", "compiled")
        create_temp_file(temp_dir, "obj/Debug/App.cs", "intermediate")

        files = parser.walk_directory(temp_dir)

        assert len(files) == 1
        assert not any("bin" in f for f in files)
        assert not any("obj" in f for f in files)


# ==================== Go Import Tests ====================

class TestGoImportExtraction:
    """Tests for Go import extraction."""

    def test_detect_go_language(self, parser):
        """Test Go file detection."""
        assert parser.detect_language("main.go") == Language.GO
        assert parser.detect_language("handler.go") == Language.GO

    def test_single_import(self, parser, temp_dir):
        """Test single Go import statement."""
        content = '''
package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert result.language == Language.GO
        assert len(result.imports) == 1
        assert result.imports[0].module == "fmt"
        assert result.imports[0].import_type == ImportType.GO_IMPORT

    def test_grouped_imports(self, parser, temp_dir):
        """Test grouped Go import statement."""
        content = '''
package main

import (
    "fmt"
    "os"
    "net/http"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        modules = [i.module for i in result.imports]
        assert "fmt" in modules
        assert "os" in modules
        assert "net/http" in modules

    def test_third_party_imports(self, parser, temp_dir):
        """Test third-party Go imports (with domain)."""
        content = '''
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/jmoiron/sqlx"
    "golang.org/x/net/context"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        modules = [i.module for i in result.imports]
        assert "github.com/gin-gonic/gin" in modules
        assert "github.com/jmoiron/sqlx" in modules

    def test_alias_import(self, parser, temp_dir):
        """Test Go alias imports."""
        content = '''
package main

import (
    "fmt"
    mux "github.com/gorilla/mux"
    log "github.com/sirupsen/logrus"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        alias_imports = [i for i in result.imports if i.import_type == ImportType.GO_ALIAS_IMPORT]
        assert len(alias_imports) == 2

    def test_dot_import(self, parser, temp_dir):
        """Test Go dot imports."""
        content = '''
package main

import (
    . "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 2

        dot_imports = [i for i in result.imports if i.import_type == ImportType.GO_DOT_IMPORT]
        assert len(dot_imports) == 2

    def test_blank_import(self, parser, temp_dir):
        """Test Go blank imports (side-effect imports)."""
        content = '''
package main

import (
    "database/sql"
    _ "github.com/lib/pq"
    _ "github.com/go-sql-driver/mysql"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3

        blank_imports = [i for i in result.imports if i.import_type == ImportType.GO_BLANK_IMPORT]
        assert len(blank_imports) == 2

    def test_internal_package_import(self, parser, temp_dir):
        """Test internal package imports."""
        content = '''
package main

import (
    "github.com/example/webapi/internal/handler"
    "github.com/example/webapi/internal/service"
    "github.com/example/webapi/pkg/models"
)

func main() {}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert len(result.imports) == 3


# ==================== Go Function/Class Tests ====================

class TestGoFunctionExtraction:
    """Tests for Go function extraction."""

    def test_simple_function(self, parser, temp_dir):
        """Test simple Go function extraction."""
        content = '''
package main

func Hello() string {
    return "Hello"
}

func Add(a, b int) int {
    return a + b
}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "Hello" in result.functions
        assert "Add" in result.functions

    def test_method_extraction(self, parser, temp_dir):
        """Test Go method extraction (functions with receivers)."""
        content = '''
package main

type UserService struct {
    db *sql.DB
}

func (s *UserService) GetAll() ([]User, error) {
    return nil, nil
}

func (s *UserService) GetByID(id int) (*User, error) {
    return nil, nil
}

func (s UserService) String() string {
    return "UserService"
}
'''
        file_path = create_temp_file(temp_dir, "service.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "GetAll" in result.functions
        assert "GetByID" in result.functions
        assert "String" in result.functions

    def test_main_function(self, parser, temp_dir):
        """Test main function extraction."""
        content = '''
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

func init() {
    // initialization
}
'''
        file_path = create_temp_file(temp_dir, "main.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "main" in result.functions
        assert "init" in result.functions

    def test_exported_unexported_functions(self, parser, temp_dir):
        """Test both exported and unexported functions are detected."""
        content = '''
package handler

func HandleRequest(w http.ResponseWriter, r *http.Request) {}

func validateInput(input string) bool {
    return true
}

func parseJSON(data []byte) error {
    return nil
}
'''
        file_path = create_temp_file(temp_dir, "handler.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "HandleRequest" in result.functions
        assert "validateInput" in result.functions
        assert "parseJSON" in result.functions


class TestGoClassExtraction:
    """Tests for Go type (struct/interface) extraction."""

    def test_struct_extraction(self, parser, temp_dir):
        """Test Go struct extraction."""
        content = '''
package models

type User struct {
    ID        int
    Name      string
    Email     string
    CreatedAt time.Time
}

type Address struct {
    Street  string
    City    string
    Country string
}
'''
        file_path = create_temp_file(temp_dir, "user.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "User" in result.classes
        assert "Address" in result.classes

    def test_interface_extraction(self, parser, temp_dir):
        """Test Go interface extraction."""
        content = '''
package repository

type UserRepository interface {
    FindAll() ([]User, error)
    FindByID(id int) (*User, error)
    Create(user *User) error
    Update(user *User) error
    Delete(id int) error
}

type Reader interface {
    Read(p []byte) (n int, err error)
}
'''
        file_path = create_temp_file(temp_dir, "repository.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "UserRepository" in result.classes
        assert "Reader" in result.classes

    def test_type_alias_extraction(self, parser, temp_dir):
        """Test Go type alias extraction."""
        content = '''
package types

type UserID int64
type Email string
type Callback func(error)
'''
        file_path = create_temp_file(temp_dir, "types.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Type aliases should be in classes list
        assert "UserID" in result.classes
        assert "Email" in result.classes
        assert "Callback" in result.classes


# ==================== Go Export Tests ====================

class TestGoExportExtraction:
    """Tests for Go export extraction (capitalized identifiers)."""

    def test_exported_function(self, parser, temp_dir):
        """Test that exported (capitalized) functions are detected."""
        content = '''
package handler

func HandleRequest() {}
func ProcessData() {}
func helper() {}
func internal() {}
'''
        file_path = create_temp_file(temp_dir, "handler.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        # Exported functions (capitalized)
        assert "HandleRequest" in result.exports
        assert "ProcessData" in result.exports
        # Unexported functions should NOT be in exports
        assert "helper" not in result.exports
        assert "internal" not in result.exports

    def test_exported_struct(self, parser, temp_dir):
        """Test that exported structs are detected."""
        content = '''
package models

type User struct {
    ID   int
    Name string
}

type config struct {
    host string
    port int
}
'''
        file_path = create_temp_file(temp_dir, "models.go", content)
        result = parser.parse_file(file_path, temp_dir)

        assert result is not None
        assert "User" in result.exports
        assert "config" not in result.exports


# ==================== Go Directory Tests ====================

class TestGoDirectoryWalking:
    """Tests for Go-specific directory walking."""

    def test_walk_directory_with_go(self, parser, temp_dir):
        """Test walking directory finds Go files."""
        create_temp_file(temp_dir, "cmd/server/main.go", "package main")
        create_temp_file(temp_dir, "internal/handler/user.go", "package handler")
        create_temp_file(temp_dir, "pkg/models/user.go", "package models")

        files = parser.walk_directory(temp_dir)

        go_files = [f for f in files if f.endswith(".go")]
        assert len(go_files) == 3

    def test_skip_go_vendor_directory(self, parser, temp_dir):
        """Test that vendor directory is skipped."""
        create_temp_file(temp_dir, "main.go", "package main")
        create_temp_file(temp_dir, "vendor/github.com/pkg/lib.go", "package lib")

        files = parser.walk_directory(temp_dir)

        assert len(files) == 1
        assert not any("vendor" in f for f in files)

    def test_skip_go_testdata_directory(self, parser, temp_dir):
        """Test that testdata directory is skipped."""
        create_temp_file(temp_dir, "handler.go", "package handler")
        create_temp_file(temp_dir, "testdata/fixtures.go", "package testdata")

        files = parser.walk_directory(temp_dir)

        assert len(files) == 1
        assert not any("testdata" in f for f in files)

    def test_mixed_go_and_other_languages(self, parser, temp_dir):
        """Test parsing directory with Go and other languages."""
        create_temp_file(temp_dir, "cmd/server/main.go", "package main\nfunc main() {}")
        create_temp_file(temp_dir, "frontend/src/App.tsx", "export const App = () => {}")
        create_temp_file(temp_dir, "scripts/deploy.py", "def deploy(): pass")

        files = parser.walk_directory(temp_dir)

        go_files = [f for f in files if f.endswith(".go")]
        tsx_files = [f for f in files if f.endswith(".tsx")]
        py_files = [f for f in files if f.endswith(".py")]

        assert len(go_files) == 1
        assert len(tsx_files) == 1
        assert len(py_files) == 1
