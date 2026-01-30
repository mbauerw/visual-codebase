import Foundation

/// A user model representing an authenticated user.
public struct User: Codable, Identifiable {
    public let id: UUID
    public let name: String
    public let email: String
    public let createdAt: Date

    public init(id: UUID = UUID(), name: String, email: String, createdAt: Date = Date()) {
        self.id = id
        self.name = name
        self.email = email
        self.createdAt = createdAt
    }
}

/// Request model for creating a new user.
struct CreateUserRequest: Codable {
    let name: String
    let email: String
}
