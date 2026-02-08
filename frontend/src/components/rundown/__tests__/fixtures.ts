import type { CodebaseRundown } from '../../../types';

export const mockRundown: CodebaseRundown = {
  layers: [
    {
      id: 'presentation',
      label: 'Presentation Layer',
      description: 'Handles UI rendering and user interaction',
      order: 0,
      roles: ['react_component', 'hook'],
      key_files: ['src/App.tsx', 'src/components/Button.tsx'],
    },
    {
      id: 'logic',
      label: 'Business Logic',
      description: 'Core application logic and state management',
      order: 1,
      roles: ['store', 'context'],
      key_files: ['src/hooks/useAuth.ts'],
    },
    {
      id: 'data',
      label: 'Data Access',
      description: 'Database and API interactions',
      order: 2,
      roles: ['api_service'],
      key_files: ['src/api/client.ts'],
    },
  ],
  entry_points: [
    {
      file_path: 'src/App.tsx',
      description: 'Main application entry point',
      starts_flow: 'main_flow',
    },
  ],
  flows: [
    {
      id: 'main_flow',
      name: 'User Authentication',
      description: 'Handles user login and session management',
      steps: [
        {
          layer_id: 'presentation',
          action: 'Renders login form and captures credentials',
          key_files: ['src/App.tsx'],
        },
        {
          layer_id: 'logic',
          action: 'Validates credentials and manages session state',
          key_files: ['src/hooks/useAuth.ts'],
        },
        {
          layer_id: 'data',
          action: 'Calls authentication API',
          key_files: ['src/api/client.ts'],
        },
      ],
    },
    {
      id: 'data_flow',
      name: 'Data Fetching',
      description: 'Fetches and displays data from the API',
      steps: [
        {
          layer_id: 'presentation',
          action: 'Triggers data fetch on component mount',
          key_files: ['src/App.tsx'],
        },
        {
          layer_id: 'data',
          action: 'Makes API request and returns data',
          key_files: ['src/api/client.ts'],
        },
      ],
    },
  ],
  cross_cutting: [
    {
      name: 'Error Handling',
      description: 'Centralized error handling and user notifications',
      files: ['src/utils/errors.ts'],
    },
    {
      name: 'Configuration',
      description: 'Application configuration and environment settings',
      files: ['src/config/supabase.ts'],
    },
  ],
  narrative:
    'This application is structured as a three-tier web app with a clear separation between presentation, business logic, and data access layers. The main entry point is App.tsx which orchestrates the UI rendering.',
};

export const mockEmptyRundown: CodebaseRundown = {
  layers: [],
  entry_points: [],
  flows: [],
  cross_cutting: [],
  narrative: '',
};
