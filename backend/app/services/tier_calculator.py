"""Service for calculating function importance tiers."""
import os
import uuid
from typing import Optional
from collections import defaultdict

from ..models.schemas import (
    FunctionCallInfo,
    FunctionDefinition,
    FunctionTierItem,
    FunctionStats,
    FunctionType,
    TierLevel,
    CallOrigin,
)


class TierCalculator:
    """Calculates function importance tiers based on call counts and other factors."""

    # Percentile thresholds for each tier
    DEFAULT_THRESHOLDS = {
        TierLevel.S: {"percentile_min": 95},   # Top 5%
        TierLevel.A: {"percentile_min": 80},   # Top 6-20%
        TierLevel.B: {"percentile_min": 50},   # Top 21-50%
        TierLevel.C: {"percentile_min": 20},   # Top 51-80%
        TierLevel.D: {"percentile_min": 5},    # Top 81-95%
        TierLevel.F: {"percentile_min": 0},    # Bottom 5%
    }

    def __init__(self, base_path: str):
        """Initialize the tier calculator.

        Args:
            base_path: Base directory path for computing relative paths
        """
        self.base_path = base_path
        self.thresholds = self.DEFAULT_THRESHOLDS

    def classify(
        self,
        functions: list[FunctionDefinition],
        calls: list[FunctionCallInfo],
        node_id_map: dict[str, str],
    ) -> tuple[list[FunctionTierItem], FunctionStats]:
        """Classify functions into tiers based on call counts.

        Args:
            functions: List of function definitions
            calls: List of resolved function calls
            node_id_map: Map of file paths to node IDs

        Returns:
            Tuple of (tier items, statistics)
        """
        if not functions:
            return [], FunctionStats(
                total_functions=0,
                total_calls=0,
                tier_counts={tier.value: 0 for tier in TierLevel},
                top_functions=[],
            )

        # Aggregate call counts per function
        call_counts = self._aggregate_calls(functions, calls)

        # Calculate weighted scores
        scored_functions = self._calculate_scores(functions, call_counts)

        # Assign tiers based on percentiles
        tier_items = self._assign_tiers(scored_functions, node_id_map)

        # Calculate statistics
        stats = self._calculate_stats(tier_items, calls)

        return tier_items, stats

    def _aggregate_calls(
        self,
        functions: list[FunctionDefinition],
        calls: list[FunctionCallInfo],
    ) -> dict[str, dict[str, int]]:
        """Aggregate call counts for each function.

        Args:
            functions: List of function definitions
            calls: List of function calls

        Returns:
            Dict mapping (file_path, func_name) -> {"internal": count, "external": count}
        """
        counts: dict[str, dict[str, int]] = defaultdict(
            lambda: {"internal": 0, "external": 0}
        )

        # Build a lookup for function names per file
        func_lookup: dict[str, set[str]] = defaultdict(set)
        for func in functions:
            func_lookup[func.file_path].add(func.name)

        for call in calls:
            if not call.resolved_target:
                continue

            # Find matching function in target file
            target_funcs = func_lookup.get(call.resolved_target, set())
            if call.callee_name in target_funcs:
                key = f"{call.resolved_target}:{call.callee_name}"
                if call.origin == CallOrigin.EXTERNAL:
                    counts[key]["external"] += 1
                else:
                    counts[key]["internal"] += 1

        return counts

    def _calculate_scores(
        self,
        functions: list[FunctionDefinition],
        call_counts: dict[str, dict[str, int]],
    ) -> list[tuple[FunctionDefinition, float, int, int]]:
        """Calculate weighted importance scores for functions.

        Args:
            functions: List of function definitions
            call_counts: Aggregated call counts

        Returns:
            List of (function, score, internal_calls, external_calls)
        """
        scored = []

        for func in functions:
            key = f"{func.file_path}:{func.name}"
            counts = call_counts.get(key, {"internal": 0, "external": 0})
            internal_calls = counts["internal"]
            external_calls = counts["external"]

            score = self._calculate_weighted_score(
                func, internal_calls, external_calls
            )
            scored.append((func, score, internal_calls, external_calls))

        return scored

    def _calculate_weighted_score(
        self,
        func: FunctionDefinition,
        internal_calls: int,
        external_calls: int,
    ) -> float:
        """Calculate importance score with weighting factors.

        Args:
            func: Function definition
            internal_calls: Number of internal calls
            external_calls: Number of external calls

        Returns:
            Weighted importance score
        """
        # Base score is internal call count (what we care about most)
        base_score = float(internal_calls)

        # Exported functions get a boost (API surface)
        if func.is_exported:
            base_score += 2.0

        # Entry points are inherently important
        if func.is_entry_point:
            base_score += 5.0

        # Hooks are architecturally significant
        if func.function_type == FunctionType.HOOK:
            base_score *= 1.2

        # Constructors are called implicitly when class is instantiated
        if func.function_type == FunctionType.CONSTRUCTOR:
            base_score += 1.0

        return base_score

    def _assign_tiers(
        self,
        scored_functions: list[tuple[FunctionDefinition, float, int, int]],
        node_id_map: dict[str, str],
    ) -> list[FunctionTierItem]:
        """Assign tiers to functions based on their scores.

        Args:
            scored_functions: List of (function, score, internal_calls, external_calls)
            node_id_map: Map of file paths to node IDs

        Returns:
            List of FunctionTierItem with assigned tiers
        """
        if not scored_functions:
            return []

        # Sort by score descending
        sorted_funcs = sorted(scored_functions, key=lambda x: x[1], reverse=True)

        tier_items = []
        total = len(sorted_funcs)

        for rank, (func, score, internal_calls, external_calls) in enumerate(sorted_funcs):
            # Calculate percentile (100 = highest, 0 = lowest)
            percentile = 100.0 * (total - rank - 1) / max(total - 1, 1)

            # Determine tier
            tier = self._get_tier_for_percentile(percentile, score)

            # Get node ID for the file
            rel_path = os.path.relpath(func.file_path, self.base_path)
            node_id = node_id_map.get(rel_path, rel_path)

            tier_items.append(FunctionTierItem(
                id=str(uuid.uuid4()),
                function_name=func.name,
                qualified_name=func.qualified_name,
                function_type=func.function_type,
                file_path=rel_path,
                file_name=os.path.basename(func.file_path),
                node_id=node_id,
                internal_call_count=internal_calls,
                external_call_count=external_calls,
                is_exported=func.is_exported,
                is_entry_point=func.is_entry_point,
                tier=tier,
                tier_percentile=round(percentile, 1),
                start_line=func.start_line,
                end_line=func.end_line,
                is_async=func.is_async,
                parameters_count=func.parameters_count,
            ))

        return tier_items

    def _get_tier_for_percentile(self, percentile: float, score: float) -> TierLevel:
        """Get the tier level for a given percentile.

        Args:
            percentile: The function's percentile (0-100)
            score: The function's weighted score

        Returns:
            Appropriate TierLevel
        """
        # Special case: zero score always gets F tier
        if score == 0:
            return TierLevel.F

        # Check tiers in order (S first, then A, B, C, D, F)
        tier_order = [TierLevel.S, TierLevel.A, TierLevel.B, TierLevel.C, TierLevel.D, TierLevel.F]

        for tier in tier_order:
            if percentile >= self.thresholds[tier]["percentile_min"]:
                return tier

        return TierLevel.F

    def _calculate_stats(
        self,
        tier_items: list[FunctionTierItem],
        calls: list[FunctionCallInfo],
    ) -> FunctionStats:
        """Calculate summary statistics.

        Args:
            tier_items: List of classified functions
            calls: List of all function calls

        Returns:
            FunctionStats summary
        """
        tier_counts = {tier.value: 0 for tier in TierLevel}
        for item in tier_items:
            tier_counts[item.tier.value] += 1

        # Get top 5 functions by call count
        sorted_items = sorted(
            tier_items,
            key=lambda x: x.internal_call_count,
            reverse=True
        )
        top_functions = [item.function_name for item in sorted_items[:5]]

        return FunctionStats(
            total_functions=len(tier_items),
            total_calls=len(calls),
            tier_counts=tier_counts,
            top_functions=top_functions,
        )


def create_tier_calculator(base_path: str) -> TierCalculator:
    """Create a tier calculator instance.

    Args:
        base_path: Base directory path

    Returns:
        Configured TierCalculator instance
    """
    return TierCalculator(base_path)
