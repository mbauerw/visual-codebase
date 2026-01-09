"""
Tests for the FunctionAnalyzer service.
Covers function definition extraction, arrow function detection, method extraction,
async function detection, parameter counting, exported function detection, and entry point detection.
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.services.function_analyzer import FunctionAnalyzer, get_function_analyzer
from app.services.parser import FileParser
from app.models.schemas import (
    FunctionDefinition,
    FunctionCallInfo,
    FunctionType,
    CallType,
    CallOrigin,
    Language,
    ParsedFile,
    ImportInfo,
)


# ==================== Fixtures ====================

@pytest.fixture
def analyzer():
    """Create a fresh FunctionAnalyzer instance for each test."""
    return FunctionAnalyzer()


@pytest.fixture
def parser():
    """Create a FileParser instance."""
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


def create_parsed_file(
    file_path: str,
    content: str,
    temp_dir: str,
    language: Language = Language.TYPESCRIPT,
    exports: list[str] = None
) -> ParsedFile:
    """Create a ParsedFile object for testing."""
    return ParsedFile(
        path=file_path,
        relative_path=os.path.relpath(file_path, temp_dir),
        name=os.path.basename(file_path),
        folder=os.path.dirname(os.path.relpath(file_path, temp_dir)),
        language=language,
        imports=[],
        exports=exports or [],
        functions=[],
        classes=[],
        size_bytes=len(content),
        line_count=content.count("\n") + 1,
        content=content,
    )


# ==================== Function Definition Extraction Tests ====================

class TestFunctionDefinitionExtraction:
    """Tests for extracting function definitions."""

    def test_js_function_declaration(self, analyzer, temp_dir):
        """Test JavaScript function declaration extraction."""
        content = '''
function processData(data) {
    return data.map(x => x * 2);
}

function validateInput(input) {
    return input.length > 0;
}
'''
        file_path = create_temp_file(temp_dir, "utils.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        assert len(functions) == 2
        func_names = [f.name for f in functions]
        assert "processData" in func_names
        assert "validateInput" in func_names

    def test_ts_function_declaration(self, analyzer, temp_dir):
        """Test TypeScript function declaration extraction."""
        content = '''
function fetchUser(id: string): Promise<User> {
    return api.get(`/users/${id}`);
}

function createUser(data: UserData): User {
    return { id: generateId(), ...data };
}
'''
        file_path = create_temp_file(temp_dir, "api.ts", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.TYPESCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        assert len(functions) == 2
        func_names = [f.name for f in functions]
        assert "fetchUser" in func_names
        assert "createUser" in func_names


# ==================== Arrow Function Detection Tests ====================

class TestArrowFunctionDetection:
    """Tests for arrow function detection."""

    def test_arrow_function_const(self, analyzer, temp_dir):
        """Test arrow function assigned to const."""
        content = '''
const handleClick = () => {
    console.log('clicked');
};

const processItem = (item) => item * 2;

const fetchData = async () => {
    return await api.get('/data');
};
'''
        file_path = create_temp_file(temp_dir, "handlers.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func_names = [f.name for f in functions]
        assert "handleClick" in func_names
        assert "processItem" in func_names
        assert "fetchData" in func_names

    def test_arrow_function_in_object(self, analyzer, temp_dir):
        """Test arrow functions in object literals are detected."""
        content = '''
const actions = {
    increment: (state) => state + 1,
    decrement: (state) => state - 1,
};
'''
        file_path = create_temp_file(temp_dir, "actions.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func_names = [f.name for f in functions]
        assert "increment" in func_names
        assert "decrement" in func_names


# ==================== Method Extraction Tests ====================

class TestMethodExtraction:
    """Tests for extracting methods from classes."""

    def test_class_methods_js(self, analyzer, temp_dir):
        """Test JavaScript class method extraction."""
        content = '''
class UserService {
    constructor(db) {
        this.db = db;
    }

    getUser(id) {
        return this.db.find(id);
    }

    async updateUser(id, data) {
        return await this.db.update(id, data);
    }

    static createInstance() {
        return new UserService(new Database());
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func_names = [f.name for f in functions]
        assert "constructor" in func_names
        assert "getUser" in func_names
        assert "updateUser" in func_names
        assert "createInstance" in func_names

    def test_class_methods_python(self, analyzer, temp_dir):
        """Test Python class method extraction."""
        content = '''
class UserService:
    def __init__(self, db):
        self.db = db

    def get_user(self, user_id):
        return self.db.find(user_id)

    async def update_user(self, user_id, data):
        return await self.db.update(user_id, data)

    @classmethod
    def create(cls, config):
        return cls(Database(config))

    @staticmethod
    def validate(data):
        return len(data) > 0
'''
        file_path = create_temp_file(temp_dir, "user_service.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        func_names = [f.name for f in functions]
        assert "__init__" in func_names
        assert "get_user" in func_names
        assert "update_user" in func_names
        assert "create" in func_names
        assert "validate" in func_names


# ==================== Async Function Detection Tests ====================

class TestAsyncFunctionDetection:
    """Tests for async function detection."""

    def test_async_function_js(self, analyzer, temp_dir):
        """Test async function detection in JavaScript."""
        content = '''
async function fetchData() {
    return await api.get('/data');
}

const asyncHandler = async () => {
    return await process();
};

function syncFunction() {
    return 'sync';
}
'''
        file_path = create_temp_file(temp_dir, "async.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        async_funcs = [f for f in functions if f.is_async]
        sync_funcs = [f for f in functions if not f.is_async]

        assert len(async_funcs) >= 1
        async_names = [f.name for f in async_funcs]
        assert "fetchData" in async_names

    def test_async_function_python(self, analyzer, temp_dir):
        """Test async function detection in Python."""
        content = '''
async def fetch_user(user_id):
    return await db.get(user_id)

async def process_data(data):
    results = await asyncio.gather(*[process(d) for d in data])
    return results

def sync_function():
    return 'sync'
'''
        file_path = create_temp_file(temp_dir, "async_funcs.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        async_funcs = [f for f in functions if f.is_async]
        assert len(async_funcs) >= 1


# ==================== Parameter Counting Tests ====================

class TestParameterCounting:
    """Tests for parameter counting."""

    def test_js_parameter_count(self, analyzer, temp_dir):
        """Test JavaScript parameter counting."""
        content = '''
function noParams() {}
function oneParam(a) {}
function twoParams(a, b) {}
function threeParams(a, b, c) {}
function withDefaults(a, b = 1, c = 'default') {}
function withRest(a, ...rest) {}
'''
        file_path = create_temp_file(temp_dir, "params.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        assert func_dict["noParams"].parameters_count == 0
        assert func_dict["oneParam"].parameters_count == 1
        assert func_dict["twoParams"].parameters_count == 2
        assert func_dict["threeParams"].parameters_count == 3

    def test_python_parameter_count_excludes_self(self, analyzer, temp_dir):
        """Test Python parameter counting excludes self/cls."""
        content = '''
class MyClass:
    def method_no_params(self):
        pass

    def method_one_param(self, a):
        pass

    def method_two_params(self, a, b):
        pass

    @classmethod
    def class_method(cls, a):
        pass
'''
        file_path = create_temp_file(temp_dir, "class_params.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        # self/cls should be excluded from count
        assert func_dict["method_no_params"].parameters_count == 0
        assert func_dict["method_one_param"].parameters_count == 1
        assert func_dict["method_two_params"].parameters_count == 2
        assert func_dict["class_method"].parameters_count == 1


# ==================== Exported Function Detection Tests ====================

class TestExportedFunctionDetection:
    """Tests for detecting exported functions."""

    def test_exported_functions_js(self, analyzer, temp_dir):
        """Test detection of exported functions in JavaScript."""
        content = '''
export function publicFunction() {
    return 'public';
}

export const exportedArrow = () => 'arrow';

function privateFunction() {
    return 'private';
}
'''
        file_path = create_temp_file(temp_dir, "exports.js", content)
        parsed_file = create_parsed_file(
            file_path, content, temp_dir,
            Language.JAVASCRIPT,
            exports=["publicFunction", "exportedArrow"]
        )

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        assert func_dict["publicFunction"].is_exported is True
        assert func_dict["exportedArrow"].is_exported is True
        assert func_dict["privateFunction"].is_exported is False

    def test_python_private_functions(self, analyzer, temp_dir):
        """Test Python private function detection (underscore prefix)."""
        content = '''
def public_function():
    pass

def _private_function():
    pass

def __very_private():
    pass
'''
        file_path = create_temp_file(temp_dir, "funcs.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        assert func_dict["public_function"].is_exported is True
        assert func_dict["_private_function"].is_exported is False


# ==================== Entry Point Detection Tests ====================

class TestEntryPointDetection:
    """Tests for entry point detection."""

    def test_main_function_detection(self, analyzer, temp_dir):
        """Test detection of main function as entry point."""
        content = '''
def main():
    print("Hello, World!")

def helper():
    pass

if __name__ == "__main__":
    main()
'''
        file_path = create_temp_file(temp_dir, "app.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        assert func_dict["main"].is_entry_point is True
        assert func_dict["helper"].is_entry_point is False

    def test_handler_function_detection(self, analyzer, temp_dir):
        """Test detection of handler functions as entry points."""
        content = '''
export function handler(event, context) {
    return { statusCode: 200 };
}

function handleRequest(req, res) {
    res.send('OK');
}

function getUsers() {
    return [];
}

function postUser(data) {
    return { id: 1 };
}
'''
        file_path = create_temp_file(temp_dir, "lambda.js", content)
        parsed_file = create_parsed_file(
            file_path, content, temp_dir,
            Language.JAVASCRIPT,
            exports=["handler"]
        )

        functions, calls = analyzer.analyze([parsed_file])

        func_dict = {f.name: f for f in functions}
        assert func_dict["handler"].is_entry_point is True
        assert func_dict["handleRequest"].is_entry_point is True
        assert func_dict["getUsers"].is_entry_point is True
        assert func_dict["postUser"].is_entry_point is True


# ==================== Function Call Extraction Tests ====================

class TestFunctionCallExtraction:
    """Tests for extracting function calls."""

    def test_direct_function_call(self, analyzer, temp_dir):
        """Test extraction of direct function calls."""
        content = '''
function caller() {
    processData();
    validateInput('test');
    return formatOutput();
}
'''
        file_path = create_temp_file(temp_dir, "caller.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        call_names = [c.callee_name for c in calls]
        assert "processData" in call_names
        assert "validateInput" in call_names
        assert "formatOutput" in call_names

    def test_method_call(self, analyzer, temp_dir):
        """Test extraction of method calls."""
        content = '''
function processUser(user) {
    user.validate();
    const data = service.getData();
    return api.post('/users', data);
}
'''
        file_path = create_temp_file(temp_dir, "process.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        method_calls = [c for c in calls if c.call_type == CallType.METHOD]
        method_names = [c.callee_name for c in method_calls]

        assert "validate" in method_names
        assert "getData" in method_names
        assert "post" in method_names

    def test_constructor_call(self, analyzer, temp_dir):
        """Test extraction of constructor calls."""
        content = '''
function createInstances() {
    const user = new User('John');
    const service = new UserService(db);
    return { user, service };
}
'''
        file_path = create_temp_file(temp_dir, "factory.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        constructor_calls = [c for c in calls if c.call_type == CallType.CONSTRUCTOR]
        constructor_names = [c.callee_name for c in constructor_calls]

        assert "User" in constructor_names
        assert "UserService" in constructor_names

    def test_python_function_calls(self, analyzer, temp_dir):
        """Test extraction of Python function calls."""
        content = '''
def main():
    data = fetch_data()
    processed = process_data(data)
    result = service.save(processed)
    return result
'''
        file_path = create_temp_file(temp_dir, "main.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        call_names = [c.callee_name for c in calls]
        assert "fetch_data" in call_names
        assert "process_data" in call_names
        assert "save" in call_names


# ==================== Call Location Tests ====================

class TestCallLocation:
    """Tests for call location tracking."""

    def test_call_line_numbers(self, analyzer, temp_dir):
        """Test that call line numbers are tracked."""
        content = '''function test() {
    foo();
    bar();
}
'''
        file_path = create_temp_file(temp_dir, "test.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        # Verify line numbers are tracked
        for call in calls:
            assert call.line_number > 0
            assert call.source_file == file_path


# ==================== Built-in Filtering Tests ====================

class TestBuiltinFiltering:
    """Tests for filtering out built-in function calls."""

    def test_js_console_filtered(self, analyzer, temp_dir):
        """Test that console.log calls are filtered."""
        content = '''
function logStuff() {
    console.log('hello');
    console.error('error');
    customFunction();
}
'''
        file_path = create_temp_file(temp_dir, "log.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        call_names = [c.callee_name for c in calls]
        # console methods should be filtered
        assert "log" not in call_names
        assert "error" not in call_names
        # custom function should be included
        assert "customFunction" in call_names

    def test_python_builtins_filtered(self, analyzer, temp_dir):
        """Test that Python built-in calls are filtered."""
        content = '''
def process():
    data = list(range(10))
    length = len(data)
    text = str(length)
    custom_function(text)
'''
        file_path = create_temp_file(temp_dir, "process.py", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.PYTHON)

        functions, calls = analyzer.analyze([parsed_file])

        call_names = [c.callee_name for c in calls]
        # Built-ins should be filtered
        assert "list" not in call_names
        assert "len" not in call_names
        assert "str" not in call_names
        # Custom function should be included
        assert "custom_function" in call_names


# ==================== React Hook Detection Tests ====================

class TestReactHookType:
    """Tests for React hook function type detection."""

    def test_custom_hook_type(self, analyzer, temp_dir):
        """Test that custom hooks are detected with correct type."""
        content = '''
export function useCustomHook() {
    const [state, setState] = useState(null);
    return { state, setState };
}

export const useAnotherHook = () => {
    return useQuery('key');
};
'''
        file_path = create_temp_file(temp_dir, "hooks.ts", content)
        parsed_file = create_parsed_file(
            file_path, content, temp_dir,
            Language.TYPESCRIPT,
            exports=["useCustomHook", "useAnotherHook"]
        )

        functions, calls = analyzer.analyze([parsed_file])

        hook_funcs = [f for f in functions if f.function_type == FunctionType.HOOK]
        assert len(hook_funcs) >= 1
        hook_names = [f.name for f in hook_funcs]
        assert "useCustomHook" in hook_names


# ==================== Multiple Files Analysis Tests ====================

class TestMultipleFilesAnalysis:
    """Tests for analyzing multiple files."""

    def test_analyze_multiple_files(self, analyzer, temp_dir):
        """Test analyzing multiple files at once."""
        content1 = '''
export function helper1() {
    return 'helper1';
}
'''
        content2 = '''
import { helper1 } from './utils1';

export function main() {
    return helper1();
}
'''
        file_path1 = create_temp_file(temp_dir, "utils1.js", content1)
        file_path2 = create_temp_file(temp_dir, "main.js", content2)

        parsed_file1 = create_parsed_file(
            file_path1, content1, temp_dir,
            Language.JAVASCRIPT,
            exports=["helper1"]
        )
        parsed_file2 = create_parsed_file(
            file_path2, content2, temp_dir,
            Language.JAVASCRIPT,
            exports=["main"]
        )

        functions, calls = analyzer.analyze([parsed_file1, parsed_file2])

        func_names = [f.name for f in functions]
        assert "helper1" in func_names
        assert "main" in func_names

        # main should call helper1
        call_names = [c.callee_name for c in calls]
        assert "helper1" in call_names


# ==================== Qualified Name Tests ====================

class TestQualifiedName:
    """Tests for qualified function names."""

    def test_method_qualified_name(self, analyzer, temp_dir):
        """Test that class methods have qualified names."""
        content = '''
class UserService {
    getUser(id) {
        return this.db.find(id);
    }

    updateUser(id, data) {
        return this.db.update(id, data);
    }
}
'''
        file_path = create_temp_file(temp_dir, "UserService.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        method_funcs = [f for f in functions if f.parent_class == "UserService"]
        for func in method_funcs:
            assert "UserService" in func.qualified_name


# ==================== Analyze File Content Tests ====================

class TestAnalyzeFileContent:
    """Tests for analyzing file content directly."""

    def test_analyze_file_content_js(self, analyzer, temp_dir):
        """Test analyzing JavaScript content directly."""
        content = '''
export function processData(data) {
    return data.map(x => x * 2);
}

const helper = () => 'help';
'''
        file_path = os.path.join(temp_dir, "test.js")

        functions, calls = analyzer.analyze_file_content(
            file_path, content, ["processData"]
        )

        func_names = [f.name for f in functions]
        assert "processData" in func_names
        assert "helper" in func_names

        # Check export status
        func_dict = {f.name: f for f in functions}
        assert func_dict["processData"].is_exported is True
        assert func_dict["helper"].is_exported is False

    def test_analyze_file_content_unsupported(self, analyzer, temp_dir):
        """Test analyzing unsupported file type returns empty."""
        content = "public class Main { }"
        file_path = os.path.join(temp_dir, "Main.java")

        functions, calls = analyzer.analyze_file_content(file_path, content, [])

        assert functions == []
        assert calls == []


# ==================== Error Handling Tests ====================

class TestErrorHandling:
    """Tests for error handling."""

    def test_file_without_content(self, analyzer, temp_dir):
        """Test that files without content are skipped."""
        parsed_file = ParsedFile(
            path="/test/file.js",
            relative_path="file.js",
            name="file.js",
            folder="",
            language=Language.JAVASCRIPT,
            imports=[],
            exports=[],
            functions=[],
            classes=[],
            size_bytes=100,
            line_count=10,
            content=None,  # No content
        )

        functions, calls = analyzer.analyze([parsed_file])

        assert functions == []
        assert calls == []

    def test_malformed_content(self, analyzer, temp_dir):
        """Test handling of malformed content."""
        content = '''
function broken( {
    // Missing closing paren and brace
'''
        file_path = create_temp_file(temp_dir, "broken.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        # Should not raise an exception
        functions, calls = analyzer.analyze([parsed_file])
        # Tree-sitter is error-tolerant, may still extract partial info
        assert isinstance(functions, list)
        assert isinstance(calls, list)


# ==================== Singleton Pattern Tests ====================

class TestSingletonPattern:
    """Tests for the singleton pattern."""

    def test_get_function_analyzer_returns_same_instance(self):
        """Test that get_function_analyzer returns the same instance."""
        analyzer1 = get_function_analyzer()
        analyzer2 = get_function_analyzer()

        assert analyzer1 is analyzer2


# ==================== Function Type Classification Tests ====================

class TestFunctionTypeClassification:
    """Tests for function type classification."""

    def test_regular_function_type(self, analyzer, temp_dir):
        """Test that regular functions have correct type."""
        content = '''
function regularFunction() {
    return 'regular';
}
'''
        file_path = create_temp_file(temp_dir, "regular.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func = functions[0]
        assert func.function_type == FunctionType.FUNCTION

    def test_arrow_function_type(self, analyzer, temp_dir):
        """Test that arrow functions have correct type."""
        content = '''
const arrowFunc = () => 'arrow';
'''
        file_path = create_temp_file(temp_dir, "arrow.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        func = functions[0]
        assert func.function_type == FunctionType.ARROW_FUNCTION

    def test_method_type(self, analyzer, temp_dir):
        """Test that class methods have correct type."""
        content = '''
class MyClass {
    myMethod() {
        return 'method';
    }
}
'''
        file_path = create_temp_file(temp_dir, "class.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        method_func = next((f for f in functions if f.name == "myMethod"), None)
        assert method_func is not None
        assert method_func.function_type == FunctionType.METHOD

    def test_constructor_type(self, analyzer, temp_dir):
        """Test that constructors have correct type."""
        content = '''
class MyClass {
    constructor() {
        this.value = 0;
    }
}
'''
        file_path = create_temp_file(temp_dir, "constructor.js", content)
        parsed_file = create_parsed_file(file_path, content, temp_dir, Language.JAVASCRIPT)

        functions, calls = analyzer.analyze([parsed_file])

        constructor_func = next((f for f in functions if f.name == "constructor"), None)
        assert constructor_func is not None
        assert constructor_func.function_type == FunctionType.CONSTRUCTOR
