import Foundation

/// Application-level errors.
enum AppError: Error, LocalizedError {
    case networkError(underlying: Error)
    case decodingError(underlying: Error)
    case unauthorized
    case notFound(id: String)
    case serverError(message: String)

    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized access"
        case .notFound(let id):
            return "Resource not found: \(id)"
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}
