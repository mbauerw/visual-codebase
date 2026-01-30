//! User-related HTTP handlers.

use axum::{extract::Path, Json};
use crate::models::user::{User, CreateUserRequest};
use crate::services::user_service::UserService;

/// List all users.
pub async fn list_users() -> Json<Vec<User>> {
    let service = UserService::new();
    Json(service.get_all())
}

/// Get a user by ID.
pub async fn get_user(Path(id): Path<u64>) -> Json<Option<User>> {
    let service = UserService::new();
    Json(service.get_by_id(id))
}

/// Create a new user.
pub async fn create_user(Json(req): Json<CreateUserRequest>) -> Json<User> {
    let service = UserService::new();
    Json(service.create(req))
}
