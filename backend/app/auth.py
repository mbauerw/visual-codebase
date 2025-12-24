"""Authentication utilities for Supabase integration."""
from fastapi import HTTPException, Depends, Header
from typing import Optional
from .config.supabase import get_supabase_client


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract user from Supabase JWT token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    try:
        supabase = get_supabase_client()
        # Verify the token and get user info
        user_response = supabase.auth.get_user(token)
        
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user_response.user
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")


async def get_optional_user(authorization: Optional[str] = Header(None)):
    """Get user if authenticated, otherwise return None."""
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None