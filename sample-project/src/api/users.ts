const API_BASE = '/api';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE}/users/me`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

export async function fetchUserById(id: string): Promise<User> {
  const response = await fetch(`${API_BASE}/users/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update user');
  }
  return response.json();
}
