import Foundation

/// Protocol defining user service operations.
protocol UserServiceProtocol {
    func fetchUsers() async throws -> [User]
    func fetchUser(id: UUID) async throws -> User
    func createUser(name: String, email: String) async throws -> User
    func deleteUser(id: UUID) async throws
}
