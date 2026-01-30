import Foundation

/// Service for managing user data via network requests.
class UserService: UserServiceProtocol {
    private let baseURL = URL(string: "https://api.example.com")!
    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func fetchUsers() async throws -> [User] {
        let url = baseURL.appendingPathComponent("users")
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.networkError(underlying: URLError(.badServerResponse))
        }

        switch httpResponse.statusCode {
        case 200:
            return try decoder.decode([User].self, from: data)
        case 401:
            throw AppError.unauthorized
        default:
            throw AppError.serverError(message: "Status code: \(httpResponse.statusCode)")
        }
    }

    func fetchUser(id: UUID) async throws -> User {
        let url = baseURL.appendingPathComponent("users/\(id.uuidString)")
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.networkError(underlying: URLError(.badServerResponse))
        }

        switch httpResponse.statusCode {
        case 200:
            return try decoder.decode(User.self, from: data)
        case 404:
            throw AppError.notFound(id: id.uuidString)
        default:
            throw AppError.serverError(message: "Status code: \(httpResponse.statusCode)")
        }
    }

    func createUser(name: String, email: String) async throws -> User {
        let url = baseURL.appendingPathComponent("users")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = CreateUserRequest(name: name, email: email)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, _) = try await session.data(for: request)
        return try decoder.decode(User.self, from: data)
    }

    func deleteUser(id: UUID) async throws {
        let url = baseURL.appendingPathComponent("users/\(id.uuidString)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 204 else {
            throw AppError.serverError(message: "Failed to delete user")
        }
    }
}
