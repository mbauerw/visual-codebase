import Foundation

extension String {
    /// Validates if the string is a valid email format.
    var isValidEmail: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }

    /// Trims whitespace and newlines from both ends of the string.
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Returns nil if the string is empty or contains only whitespace.
    var nilIfEmpty: String? {
        trimmed.isEmpty ? nil : self
    }
}
