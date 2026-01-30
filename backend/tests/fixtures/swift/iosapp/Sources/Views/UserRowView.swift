import SwiftUI

/// A view displaying a single user in a list row.
struct UserRowView: View {
    let user: User

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(user.name)
                .font(.headline)
            Text(user.email)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    UserRowView(user: User(name: "John Doe", email: "john@example.com"))
}
