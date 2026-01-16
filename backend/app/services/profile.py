"""Profile management service."""
import re
import secrets
from datetime import datetime
from typing import Optional, Dict, Any, List

import bcrypt

from ..config.supabase import get_supabase_admin_client
from ..models.schemas import (
    ProfileResponse,
    ProfileUpdateRequest,
    UserPreferences,
    PasswordPolicy,
    PasswordValidationResult,
    PasswordValidationCriteria,
)


class ProfileService:
    """Service for user profile management operations."""

    def __init__(self):
        self.supabase = get_supabase_admin_client()

    async def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile by ID.

        Args:
            user_id: The user's UUID

        Returns:
            Profile data dict or None if not found
        """
        result = self.supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        if not result.data:
            return None

        profile = result.data

        # Parse preferences JSON if present
        if profile.get("preferences"):
            if isinstance(profile["preferences"], str):
                import json
                profile["preferences"] = json.loads(profile["preferences"])
        else:
            profile["preferences"] = {}

        return profile

    async def update_profile(
        self,
        user_id: str,
        display_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Update user profile fields.

        Args:
            user_id: The user's UUID
            display_name: Optional new display name
            avatar_url: Optional new avatar URL
            preferences: Optional preferences to merge

        Returns:
            Updated profile data
        """
        update_data = {"updated_at": datetime.utcnow().isoformat()}

        if display_name is not None:
            update_data["display_name"] = display_name.strip() if display_name else None

        if avatar_url is not None:
            update_data["avatar_url"] = avatar_url.strip() if avatar_url else None

        if preferences is not None:
            # Get existing preferences and merge
            existing = await self.get_profile(user_id)
            existing_prefs = existing.get("preferences", {}) if existing else {}

            # Deep merge preferences
            merged_prefs = self._merge_preferences(existing_prefs, preferences)
            update_data["preferences"] = merged_prefs

        result = self.supabase.table("profiles").update(update_data).eq("id", user_id).execute()

        return result.data[0] if result.data else {}

    def _merge_preferences(self, existing: Dict, updates: Dict) -> Dict:
        """Deep merge preferences dictionaries."""
        result = existing.copy()

        for key, value in updates.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_preferences(result[key], value)
            else:
                result[key] = value

        return result

    async def change_email(
        self,
        user_id: str,
        new_email: str,
    ) -> Dict[str, Any]:
        """Change user email address.

        Note: This uses the Supabase admin API and requires email re-verification.

        Args:
            user_id: The user's UUID
            new_email: New email address

        Returns:
            Result dict with success status
        """
        try:
            # Update email via Supabase Admin API
            result = self.supabase.auth.admin.update_user_by_id(
                user_id,
                {"email": new_email}
            )

            # Also update the profiles table
            self.supabase.table("profiles").update({
                "email": new_email,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()

            return {
                "success": True,
                "message": "Email updated. Please verify your new email address."
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }

    async def change_password(
        self,
        user_id: str,
        new_password: str,
    ) -> Dict[str, Any]:
        """Change user password.

        Args:
            user_id: The user's UUID
            new_password: New password (should be pre-validated)

        Returns:
            Result dict with success status
        """
        try:
            # Check password history
            is_safe = await self._check_password_history(user_id, new_password)
            if not is_safe:
                return {
                    "success": False,
                    "message": "This password was recently used. Please choose a different password."
                }

            # Update password via Supabase Admin API
            self.supabase.auth.admin.update_user_by_id(
                user_id,
                {"password": new_password}
            )

            # Add to password history
            await self._add_to_password_history(user_id, new_password)

            return {
                "success": True,
                "message": "Password updated successfully."
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }


class PasswordService:
    """Service for password validation and history management."""

    def __init__(self):
        self.supabase = get_supabase_admin_client()

    async def get_policy(self) -> PasswordPolicy:
        """Fetch current password policy from database."""
        result = self.supabase.table("password_policy").select("*").limit(1).execute()

        if result.data:
            data = result.data[0]
            return PasswordPolicy(
                min_length=data.get("min_length", 8),
                require_uppercase=data.get("require_uppercase", True),
                require_lowercase=data.get("require_lowercase", True),
                require_number=data.get("require_number", True),
                require_special=data.get("require_special", True),
                history_count=data.get("history_count", 5),
            )

        # Return default policy
        return PasswordPolicy()

    async def validate_strength(self, password: str) -> PasswordValidationResult:
        """Validate password against strength requirements.

        Args:
            password: Password to validate

        Returns:
            Validation result with detailed criteria
        """
        policy = await self.get_policy()
        criteria: List[PasswordValidationCriteria] = []
        suggestions: List[str] = []

        # Check minimum length
        length_ok = len(password) >= policy.min_length
        criteria.append(PasswordValidationCriteria(
            criterion="min_length",
            passed=length_ok,
            message=f"At least {policy.min_length} characters" if length_ok else f"Must be at least {policy.min_length} characters"
        ))
        if not length_ok:
            suggestions.append(f"Add {policy.min_length - len(password)} more characters")

        # Check uppercase
        has_upper = bool(re.search(r'[A-Z]', password))
        criteria.append(PasswordValidationCriteria(
            criterion="uppercase",
            passed=has_upper or not policy.require_uppercase,
            message="Contains uppercase letter" if has_upper else "Add an uppercase letter"
        ))
        if policy.require_uppercase and not has_upper:
            suggestions.append("Add an uppercase letter (A-Z)")

        # Check lowercase
        has_lower = bool(re.search(r'[a-z]', password))
        criteria.append(PasswordValidationCriteria(
            criterion="lowercase",
            passed=has_lower or not policy.require_lowercase,
            message="Contains lowercase letter" if has_lower else "Add a lowercase letter"
        ))
        if policy.require_lowercase and not has_lower:
            suggestions.append("Add a lowercase letter (a-z)")

        # Check number
        has_number = bool(re.search(r'[0-9]', password))
        criteria.append(PasswordValidationCriteria(
            criterion="number",
            passed=has_number or not policy.require_number,
            message="Contains a number" if has_number else "Add a number"
        ))
        if policy.require_number and not has_number:
            suggestions.append("Add a number (0-9)")

        # Check special character
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
        criteria.append(PasswordValidationCriteria(
            criterion="special",
            passed=has_special or not policy.require_special,
            message="Contains a special character" if has_special else "Add a special character"
        ))
        if policy.require_special and not has_special:
            suggestions.append("Add a special character (!@#$%^&*)")

        # Calculate score
        passed_count = sum(1 for c in criteria if c.passed)
        total_criteria = len(criteria)
        base_score = int((passed_count / total_criteria) * 80)

        # Bonus points for extra length
        length_bonus = min(20, max(0, (len(password) - policy.min_length) * 2))
        score = min(100, base_score + length_bonus)

        # Check if all required criteria pass
        valid = all(c.passed for c in criteria)

        return PasswordValidationResult(
            valid=valid,
            score=score,
            criteria=criteria,
            suggestions=suggestions
        )

    async def check_history(self, user_id: str, password: str) -> bool:
        """Check if password was recently used.

        Args:
            user_id: User's UUID
            password: Password to check

        Returns:
            True if password is safe (not in history), False if recently used
        """
        policy = await self.get_policy()

        # Get recent password hashes
        result = self.supabase.table("password_history").select("password_hash").eq(
            "user_id", user_id
        ).order("created_at", desc=True).limit(policy.history_count).execute()

        if not result.data:
            return True

        # Check against each stored hash
        password_bytes = password.encode('utf-8')
        for row in result.data:
            stored_hash = row["password_hash"].encode('utf-8')
            if bcrypt.checkpw(password_bytes, stored_hash):
                return False

        return True

    async def add_to_history(self, user_id: str, password: str) -> None:
        """Add password hash to history.

        Also prunes old entries beyond history_count.

        Args:
            user_id: User's UUID
            password: Password to add
        """
        policy = await self.get_policy()

        # Generate bcrypt hash
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')

        # Insert new hash
        self.supabase.table("password_history").insert({
            "user_id": user_id,
            "password_hash": password_hash,
        }).execute()

        # Prune old entries
        # Get all entries for user, ordered by date
        result = self.supabase.table("password_history").select("id, created_at").eq(
            "user_id", user_id
        ).order("created_at", desc=True).execute()

        if result.data and len(result.data) > policy.history_count:
            # Delete entries beyond the history count
            old_ids = [row["id"] for row in result.data[policy.history_count:]]
            for old_id in old_ids:
                self.supabase.table("password_history").delete().eq("id", old_id).execute()


# Helper methods for ProfileService
async def _check_password_history(self, user_id: str, password: str) -> bool:
    """Check password against history."""
    password_service = PasswordService()
    return await password_service.check_history(user_id, password)

async def _add_to_password_history(self, user_id: str, password: str) -> None:
    """Add password to history."""
    password_service = PasswordService()
    await password_service.add_to_history(user_id, password)

# Attach helper methods to ProfileService
ProfileService._check_password_history = _check_password_history
ProfileService._add_to_password_history = _add_to_password_history
