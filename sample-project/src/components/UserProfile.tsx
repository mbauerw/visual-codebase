import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useUser } from '../hooks/useUser';
import { formatDate } from '../utils/date';

export function UserProfile() {
  const { user, isLoading, refetch } = useUser();

  if (isLoading) {
    return <Card>Loading...</Card>;
  }

  if (!user) {
    return <Card>User not found</Card>;
  }

  return (
    <Card title="User Profile">
      <div className="space-y-4">
        <p className="text-gray-600">Name: {user.name}</p>
        <p className="text-gray-600">Email: {user.email}</p>
        <p className="text-gray-600">Joined: {formatDate(user.createdAt)}</p>
        <Button onClick={refetch}>Refresh</Button>
      </div>
    </Card>
  );
}
