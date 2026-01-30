import SwiftUI

/// The main content view of the application.
struct ContentView: View {
    @StateObject private var viewModel = UserViewModel()
    @State private var showingAddUser = false

    var body: some View {
        NavigationStack {
            List(viewModel.users) { user in
                UserRowView(user: user)
            }
            .navigationTitle("Users")
            .toolbar {
                Button(action: { showingAddUser = true }) {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $showingAddUser) {
                AddUserView(viewModel: viewModel)
            }
            .task {
                await viewModel.fetchUsers()
            }
        }
    }
}

#Preview {
    ContentView()
}
