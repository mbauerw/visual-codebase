//! User service for business logic.

use crate::models::user::{CreateUserRequest, User};
use crate::models::error::AppError;

/// Service for user-related operations.
pub struct UserService {
    // In a real app, this would hold a database connection
}

impl UserService {
    /// Create a new UserService instance.
    pub fn new() -> Self {
        Self {}
    }

    /// Get all users.
    pub fn get_all(&self) -> Vec<User> {
        // Mock implementation
        vec![
            User::new(1, "Alice".to_string(), "alice@example.com".to_string()),
            User::new(2, "Bob".to_string(), "bob@example.com".to_string()),
        ]
    }

    /// Get a user by ID.
    pub fn get_by_id(&self, id: u64) -> Option<User> {
        self.get_all().into_iter().find(|u| u.id == id)
    }

    /// Create a new user.
    pub fn create(&self, req: CreateUserRequest) -> User {
        User::new(3, req.name, req.email)
    }

    /// Update an existing user.
    pub fn update(&self, id: u64, name: Option<String>, email: Option<String>) -> Result<User, AppError> {
        let user = self.get_by_id(id).ok_or(AppError::not_found(id))?;
        Ok(User::new(
            id,
            name.unwrap_or(user.name),
            email.unwrap_or(user.email),
        ))
    }

    /// Delete a user by ID.
    pub fn delete(&self, id: u64) -> Result<(), AppError> {
        if self.get_by_id(id).is_some() {
            Ok(())
        } else {
            Err(AppError::not_found(id))
        }
    }
}

impl Default for UserService {
    fn default() -> Self {
        Self::new()
    }
}
