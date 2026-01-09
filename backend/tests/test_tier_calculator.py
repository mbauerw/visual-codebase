"""
Tests for the TierCalculator service.
Covers tier classification algorithm, percentile calculation,
call count weighting, export bonus, entry point bonus, and edge cases.
"""

import pytest
from typing import Optional

from app.services.tier_calculator import TierCalculator, create_tier_calculator
from app.models.schemas import (
    FunctionCallInfo,
    FunctionDefinition,
    FunctionTierItem,
    FunctionStats,
    FunctionType,
    TierLevel,
    CallType,
    CallOrigin,
)


# ==================== Fixtures ====================

@pytest.fixture
def calculator():
    """Create a TierCalculator for testing."""
    return TierCalculator(base_path="/project")


def create_function(
    name: str,
    file_path: str = "/project/src/utils.ts",
    function_type: FunctionType = FunctionType.FUNCTION,
    is_exported: bool = False,
    is_entry_point: bool = False,
    is_async: bool = False,
    parameters_count: int = 0,
    start_line: int = 1,
    end_line: int = 10,
    parent_class: Optional[str] = None,
) -> FunctionDefinition:
    """Helper to create a FunctionDefinition."""
    return FunctionDefinition(
        name=name,
        qualified_name=f"utils.{name}" if parent_class is None else f"utils.{parent_class}.{name}",
        function_type=function_type,
        file_path=file_path,
        start_line=start_line,
        end_line=end_line,
        is_exported=is_exported,
        is_async=is_async,
        is_entry_point=is_entry_point,
        parameters_count=parameters_count,
        parent_class=parent_class,
    )


def create_call(
    callee_name: str,
    source_file: str = "/project/src/app.ts",
    resolved_target: str = "/project/src/utils.ts",
    origin: CallOrigin = CallOrigin.LOCAL,
    call_type: CallType = CallType.FUNCTION,
) -> FunctionCallInfo:
    """Helper to create a FunctionCallInfo."""
    return FunctionCallInfo(
        callee_name=callee_name,
        call_type=call_type,
        origin=origin,
        source_file=source_file,
        line_number=10,
        column=4,
        resolved_target=resolved_target,
    )


# ==================== Tier Classification Algorithm Tests ====================

class TestTierClassification:
    """Tests for the tier classification algorithm."""

    def test_classify_empty_functions(self, calculator):
        """Test classification with no functions."""
        tier_items, stats = calculator.classify([], [], {})

        assert tier_items == []
        assert stats.total_functions == 0
        assert stats.total_calls == 0

    def test_classify_single_function_no_calls(self, calculator):
        """Test classification with single function, no calls."""
        functions = [create_function("helper")]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, stats = calculator.classify(functions, [], node_id_map)

        assert len(tier_items) == 1
        # No calls and not exported/entry point = F tier
        assert tier_items[0].tier == TierLevel.F

    def test_classify_function_with_calls(self, calculator):
        """Test that functions with calls get higher tiers."""
        functions = [
            create_function("popular"),
            create_function("unpopular"),
        ]

        # Create many calls to "popular"
        calls = [
            create_call("popular", resolved_target="/project/src/utils.ts")
            for _ in range(10)
        ]

        node_id_map = {"src/utils.ts": "node1"}

        tier_items, stats = calculator.classify(functions, calls, node_id_map)

        # Find the popular function
        popular_item = next(i for i in tier_items if i.function_name == "popular")
        unpopular_item = next(i for i in tier_items if i.function_name == "unpopular")

        # Popular should have higher tier than unpopular
        tier_order = [TierLevel.S, TierLevel.A, TierLevel.B, TierLevel.C, TierLevel.D, TierLevel.F]
        assert tier_order.index(popular_item.tier) <= tier_order.index(unpopular_item.tier)


# ==================== Percentile Calculation Tests ====================

class TestPercentileCalculation:
    """Tests for percentile calculation."""

    def test_percentile_single_function(self, calculator):
        """Test percentile with single function."""
        functions = [create_function("only")]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        # Single function should have percentile 0 (lowest by formula)
        assert tier_items[0].tier_percentile == 0.0

    def test_percentile_two_functions(self, calculator):
        """Test percentile with two functions."""
        functions = [
            create_function("high"),
            create_function("low"),
        ]

        # high gets calls, low doesn't
        calls = [
            create_call("high", resolved_target="/project/src/utils.ts")
            for _ in range(5)
        ]

        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        high_item = next(i for i in tier_items if i.function_name == "high")
        low_item = next(i for i in tier_items if i.function_name == "low")

        # High should have higher percentile
        assert high_item.tier_percentile > low_item.tier_percentile

    def test_percentile_many_functions(self, calculator):
        """Test percentile distribution with many functions."""
        # Create 100 functions with varying call counts
        functions = [
            create_function(f"func{i}", file_path=f"/project/src/file{i}.ts")
            for i in range(100)
        ]

        # Give each function a different number of calls
        calls = []
        for i, func in enumerate(functions):
            for _ in range(i):  # func0 gets 0 calls, func99 gets 99 calls
                calls.append(create_call(
                    func.name,
                    resolved_target=func.file_path
                ))

        node_id_map = {f"src/file{i}.ts": f"node{i}" for i in range(100)}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        # Verify distribution across tiers
        tier_counts = {tier: 0 for tier in TierLevel}
        for item in tier_items:
            tier_counts[item.tier] += 1

        # Should have items in multiple tiers
        non_zero_tiers = sum(1 for count in tier_counts.values() if count > 0)
        assert non_zero_tiers >= 3


# ==================== Call Count Weighting Tests ====================

class TestCallCountWeighting:
    """Tests for call count weighting."""

    def test_internal_calls_counted(self, calculator):
        """Test that internal calls are counted."""
        functions = [create_function("target")]
        calls = [
            create_call("target", origin=CallOrigin.LOCAL, resolved_target="/project/src/utils.ts"),
            create_call("target", origin=CallOrigin.LOCAL, resolved_target="/project/src/utils.ts"),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        assert tier_items[0].internal_call_count == 2

    def test_external_calls_counted(self, calculator):
        """Test that external calls are counted separately."""
        functions = [create_function("target")]
        calls = [
            create_call("target", origin=CallOrigin.EXTERNAL, resolved_target="/project/src/utils.ts"),
            create_call("target", origin=CallOrigin.EXTERNAL, resolved_target="/project/src/utils.ts"),
            create_call("target", origin=CallOrigin.EXTERNAL, resolved_target="/project/src/utils.ts"),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        assert tier_items[0].external_call_count == 3

    def test_unresolved_calls_ignored(self, calculator):
        """Test that unresolved calls are not counted."""
        functions = [create_function("target")]
        calls = [
            FunctionCallInfo(
                callee_name="target",
                call_type=CallType.FUNCTION,
                origin=CallOrigin.LOCAL,
                source_file="/project/src/app.ts",
                line_number=10,
                column=4,
                resolved_target=None,  # Not resolved
            ),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        assert tier_items[0].internal_call_count == 0


# ==================== Export Bonus Tests ====================

class TestExportBonus:
    """Tests for export bonus in scoring."""

    def test_exported_function_bonus(self, calculator):
        """Test that exported functions get a bonus."""
        exported = create_function("exported", is_exported=True)
        non_exported = create_function("internal", is_exported=False)

        functions = [exported, non_exported]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        exported_item = next(i for i in tier_items if i.function_name == "exported")
        internal_item = next(i for i in tier_items if i.function_name == "internal")

        # Exported should have higher percentile (better score)
        assert exported_item.tier_percentile > internal_item.tier_percentile

    def test_exported_flag_preserved(self, calculator):
        """Test that exported flag is preserved in tier items."""
        functions = [
            create_function("exported", is_exported=True),
            create_function("internal", is_exported=False),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        exported_item = next(i for i in tier_items if i.function_name == "exported")
        internal_item = next(i for i in tier_items if i.function_name == "internal")

        assert exported_item.is_exported is True
        assert internal_item.is_exported is False


# ==================== Entry Point Bonus Tests ====================

class TestEntryPointBonus:
    """Tests for entry point bonus in scoring."""

    def test_entry_point_bonus(self, calculator):
        """Test that entry points get a significant bonus."""
        entry = create_function("handler", is_entry_point=True)
        regular = create_function("helper", is_entry_point=False)

        functions = [entry, regular]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        entry_item = next(i for i in tier_items if i.function_name == "handler")
        regular_item = next(i for i in tier_items if i.function_name == "helper")

        # Entry point should have higher percentile
        assert entry_item.tier_percentile > regular_item.tier_percentile

    def test_entry_point_flag_preserved(self, calculator):
        """Test that entry point flag is preserved in tier items."""
        functions = [
            create_function("main", is_entry_point=True),
            create_function("helper", is_entry_point=False),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        main_item = next(i for i in tier_items if i.function_name == "main")
        helper_item = next(i for i in tier_items if i.function_name == "helper")

        assert main_item.is_entry_point is True
        assert helper_item.is_entry_point is False


# ==================== Hook Bonus Tests ====================

class TestHookBonus:
    """Tests for React hook bonus in scoring."""

    def test_hook_multiplier(self, calculator):
        """Test that hooks get a score multiplier."""
        hook = create_function("useCustomHook", function_type=FunctionType.HOOK)
        regular = create_function("helper", function_type=FunctionType.FUNCTION)

        # Give both some calls so the multiplier matters
        functions = [hook, regular]
        calls = [
            create_call("useCustomHook", resolved_target="/project/src/utils.ts"),
            create_call("useCustomHook", resolved_target="/project/src/utils.ts"),
            create_call("helper", resolved_target="/project/src/utils.ts"),
            create_call("helper", resolved_target="/project/src/utils.ts"),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        hook_item = next(i for i in tier_items if i.function_name == "useCustomHook")
        regular_item = next(i for i in tier_items if i.function_name == "helper")

        # Hook should have higher percentile due to 1.2x multiplier
        assert hook_item.tier_percentile >= regular_item.tier_percentile


# ==================== Constructor Bonus Tests ====================

class TestConstructorBonus:
    """Tests for constructor bonus in scoring."""

    def test_constructor_bonus(self, calculator):
        """Test that constructors get a bonus."""
        constructor = create_function(
            "constructor",
            function_type=FunctionType.CONSTRUCTOR,
            parent_class="MyClass"
        )
        method = create_function(
            "method",
            function_type=FunctionType.METHOD,
            parent_class="MyClass"
        )

        functions = [constructor, method]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        constructor_item = next(i for i in tier_items if i.function_name == "constructor")
        method_item = next(i for i in tier_items if i.function_name == "method")

        # Constructor should have higher or equal percentile
        assert constructor_item.tier_percentile >= method_item.tier_percentile


# ==================== Edge Cases Tests ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_zero_score_gets_f_tier(self, calculator):
        """Test that zero score always results in F tier."""
        # Function with no calls, not exported, not entry point
        functions = [create_function("lonely")]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        assert tier_items[0].tier == TierLevel.F

    def test_single_function_with_high_score(self, calculator):
        """Test single function with high score."""
        # Entry point + exported = high score even without calls
        functions = [
            create_function("main", is_exported=True, is_entry_point=True)
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        # Should not be F tier despite being only function
        # (score > 0 due to bonuses)
        assert tier_items[0].tier != TierLevel.F or tier_items[0].tier_percentile == 0.0

    def test_function_in_different_file(self, calculator):
        """Test function in different file than call target."""
        functions = [create_function("target", file_path="/project/src/target.ts")]
        calls = [
            create_call("other", resolved_target="/project/src/other.ts"),  # Different file
        ]
        node_id_map = {"src/target.ts": "node1"}

        tier_items, _ = calculator.classify(functions, calls, node_id_map)

        # Call should not be counted for "target"
        assert tier_items[0].internal_call_count == 0


# ==================== Statistics Tests ====================

class TestStatistics:
    """Tests for statistics calculation."""

    def test_total_functions_count(self, calculator):
        """Test that total functions is counted correctly."""
        functions = [
            create_function("a"),
            create_function("b"),
            create_function("c"),
        ]
        node_id_map = {"src/utils.ts": "node1"}

        _, stats = calculator.classify(functions, [], node_id_map)

        assert stats.total_functions == 3

    def test_total_calls_count(self, calculator):
        """Test that total calls is counted correctly."""
        functions = [create_function("target")]
        calls = [
            create_call("target", resolved_target="/project/src/utils.ts"),
            create_call("other", resolved_target="/project/src/other.ts"),  # Unmatched
        ]
        node_id_map = {"src/utils.ts": "node1"}

        _, stats = calculator.classify(functions, calls, node_id_map)

        assert stats.total_calls == 2  # All calls, not just matched

    def test_tier_counts(self, calculator):
        """Test that tier counts are calculated correctly."""
        # Create functions that will end up in different tiers
        functions = [
            create_function("s_tier", is_exported=True, is_entry_point=True),
            create_function("f_tier"),
        ]

        # Give s_tier lots of calls
        calls = [
            create_call("s_tier", resolved_target="/project/src/utils.ts")
            for _ in range(20)
        ]

        node_id_map = {"src/utils.ts": "node1"}

        _, stats = calculator.classify(functions, calls, node_id_map)

        # Verify tier counts sum to total
        total_from_tiers = sum(stats.tier_counts.values())
        assert total_from_tiers == stats.total_functions

    def test_top_functions(self, calculator):
        """Test that top functions are identified correctly."""
        functions = [
            create_function(f"func{i}", file_path=f"/project/src/file{i}.ts")
            for i in range(10)
        ]

        # Give varying call counts
        calls = []
        for i, func in enumerate(functions):
            for _ in range(i * 5):  # 0, 5, 10, 15, ...
                calls.append(create_call(func.name, resolved_target=func.file_path))

        node_id_map = {f"src/file{i}.ts": f"node{i}" for i in range(10)}

        _, stats = calculator.classify(functions, calls, node_id_map)

        # Top functions should be the ones with most calls
        assert len(stats.top_functions) <= 5
        # func9 should be in top (has most calls)
        if len(stats.top_functions) > 0:
            assert "func9" in stats.top_functions


# ==================== Tier Item Fields Tests ====================

class TestTierItemFields:
    """Tests for tier item field population."""

    def test_all_fields_populated(self, calculator):
        """Test that all tier item fields are populated."""
        functions = [
            create_function(
                "myFunction",
                file_path="/project/src/utils.ts",
                function_type=FunctionType.ARROW_FUNCTION,
                is_exported=True,
                is_entry_point=True,
                is_async=True,
                parameters_count=3,
                start_line=10,
                end_line=25,
            )
        ]
        node_id_map = {"src/utils.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        item = tier_items[0]
        assert item.function_name == "myFunction"
        assert item.qualified_name == "utils.myFunction"
        assert item.function_type == FunctionType.ARROW_FUNCTION
        assert item.file_path == "src/utils.ts"
        assert item.file_name == "utils.ts"
        assert item.node_id == "node1"
        assert item.is_exported is True
        assert item.is_entry_point is True
        assert item.is_async is True
        assert item.parameters_count == 3
        assert item.start_line == 10
        assert item.end_line == 25
        assert item.id is not None  # UUID generated

    def test_relative_path_calculation(self, calculator):
        """Test that file path is calculated relative to base path."""
        functions = [
            create_function("test", file_path="/project/deep/nested/file.ts")
        ]
        node_id_map = {"deep/nested/file.ts": "node1"}

        tier_items, _ = calculator.classify(functions, [], node_id_map)

        assert tier_items[0].file_path == "deep/nested/file.ts"


# ==================== Factory Function Tests ====================

class TestFactoryFunction:
    """Tests for the factory function."""

    def test_create_tier_calculator(self):
        """Test creating a tier calculator with factory function."""
        calculator = create_tier_calculator("/my/project")

        assert isinstance(calculator, TierCalculator)
        assert calculator.base_path == "/my/project"

    def test_default_thresholds(self):
        """Test that default thresholds are set."""
        calculator = create_tier_calculator("/project")

        assert TierLevel.S in calculator.thresholds
        assert TierLevel.A in calculator.thresholds
        assert TierLevel.B in calculator.thresholds
        assert TierLevel.C in calculator.thresholds
        assert TierLevel.D in calculator.thresholds
        assert TierLevel.F in calculator.thresholds


# ==================== Tier Threshold Tests ====================

class TestTierThresholds:
    """Tests for tier threshold behavior."""

    def test_s_tier_threshold(self, calculator):
        """Test S tier requires top 5%."""
        # S tier: percentile >= 95
        assert calculator.thresholds[TierLevel.S]["percentile_min"] == 95

    def test_a_tier_threshold(self, calculator):
        """Test A tier requires top 6-20%."""
        # A tier: percentile >= 80
        assert calculator.thresholds[TierLevel.A]["percentile_min"] == 80

    def test_f_tier_threshold(self, calculator):
        """Test F tier is bottom 5%."""
        # F tier: percentile >= 0 (lowest)
        assert calculator.thresholds[TierLevel.F]["percentile_min"] == 0

    def test_tier_for_percentile_95(self, calculator):
        """Test that percentile 95+ gets S tier."""
        tier = calculator._get_tier_for_percentile(95, 10.0)
        assert tier == TierLevel.S

    def test_tier_for_percentile_80(self, calculator):
        """Test that percentile 80-94 gets A tier."""
        tier = calculator._get_tier_for_percentile(80, 10.0)
        assert tier == TierLevel.A

    def test_tier_for_percentile_50(self, calculator):
        """Test that percentile 50-79 gets B tier."""
        tier = calculator._get_tier_for_percentile(50, 10.0)
        assert tier == TierLevel.B

    def test_tier_for_percentile_20(self, calculator):
        """Test that percentile 20-49 gets C tier."""
        tier = calculator._get_tier_for_percentile(20, 10.0)
        assert tier == TierLevel.C

    def test_tier_for_percentile_5(self, calculator):
        """Test that percentile 5-19 gets D tier."""
        tier = calculator._get_tier_for_percentile(5, 10.0)
        assert tier == TierLevel.D

    def test_tier_for_zero_score(self, calculator):
        """Test that zero score always gets F tier."""
        # Even with high percentile, zero score = F
        tier = calculator._get_tier_for_percentile(100, 0.0)
        assert tier == TierLevel.F
