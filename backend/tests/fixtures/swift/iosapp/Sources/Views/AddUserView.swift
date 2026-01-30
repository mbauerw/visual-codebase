import SwiftUI

/// A view for adding a new user.
struct AddUserView: View {
    @ObservedObject var viewModel: UserViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
            }
            .navigationTitle("Add User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await viewModel.createUser(name: name, email: email) {
                                dismiss()
                            }
                        }
                    }
                    .disabled(name.isEmpty || email.isEmpty)
                }
            }
        }
    }
}
