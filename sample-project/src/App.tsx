import React from 'react';
import { UserProfile } from './components/UserProfile';
import { useTheme } from './hooks/useTheme';
import { Button } from './components/Button';

export function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <header className="p-4 border-b">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">Sample App</h1>
          <Button variant="secondary" onClick={toggleTheme}>
            Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </Button>
        </div>
      </header>
      <main className="p-4 max-w-4xl mx-auto">
        <UserProfile />
      </main>
    </div>
  );
}
