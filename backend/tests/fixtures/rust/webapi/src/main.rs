//! Main entry point for the web API server.

mod handlers;
mod models;
mod services;

use axum::{routing::get, Router};
use crate::handlers::user_handler;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/users", get(user_handler::list_users))
        .route("/users/:id", get(user_handler::get_user));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
