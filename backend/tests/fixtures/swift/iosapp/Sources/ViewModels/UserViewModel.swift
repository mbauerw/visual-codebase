import Foundation
import Combine

/// View model for managing user data and state.
@MainActor
class UserViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading: Bool = false
    @Published var error: AppError?

    private let userService: UserServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    init(userService: UserServiceProtocol = UserService()) {
        self.userService = userService
    }

    func fetchUsers() async {
        isLoading = true
        error = nil

        do {
            users = try await userService.fetchUsers()
        } catch let appError as AppError {
            error = appError
        } catch {
            self.error = .networkError(underlying: error)
        }

        isLoading = false
    }

    func createUser(name: String, email: String) async -> Bool {
        isLoading = true

        do {
            let newUser = try await userService.createUser(name: name, email: email)
            users.append(newUser)
            isLoading = false
            return true
        } catch {
            self.error = .networkError(underlying: error)
            isLoading = false
            return false
        }
    }
}
