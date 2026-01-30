import Foundation

extension Date {
    /// Formats the date as a relative string (e.g., "2 hours ago").
    var relativeFormatted: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    /// Formats the date using the specified format string.
    func formatted(with format: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        return formatter.string(from: self)
    }

    /// Returns the date formatted for display (e.g., "Jan 15, 2024").
    var displayFormatted: String {
        formatted(with: "MMM d, yyyy")
    }
}
