# Supabase Setup Guide

This guide will help you set up Supabase for the Visual Codebase application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A new Supabase project created

## Backend Setup

### 1. Environment Variables

Copy the `.env.example` file to `.env` in the backend directory:

```bash
cd backend
cp .env.example .env
```

Fill in your Supabase credentials in the `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Anthropic API Key (required for LLM analysis)
ANTHROPIC_API_KEY=your_api_key_here
```

You can find these values in your Supabase project dashboard:
- Go to Settings > API
- Copy the Project URL for `SUPABASE_URL`
- Copy the `anon` `public` key for `SUPABASE_ANON_KEY`
- Copy the `service_role` `secret` key for `SUPABASE_SERVICE_ROLE_KEY`

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Database Setup

Run the migration script to create the necessary tables:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run the SQL script

This will create:
- User profiles table
- Analysis metadata table
- Analysis nodes and edges tables
- Row Level Security policies
- Necessary indexes

## Frontend Setup

### 1. Environment Variables

Copy the `.env.example` file to `.env` in the frontend directory:

```bash
cd frontend
cp .env.example .env
```

Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the same values as in the backend setup.

### 2. Install Dependencies

```bash
cd frontend
npm install
```

## Features

With Supabase integration, the application now supports:

### Authentication
- User sign up and sign in
- Password reset functionality
- Session management
- Automatic profile creation

### Data Persistence
- Analysis results are saved to the database for authenticated users
- Users can view their analysis history
- Analysis data includes metadata, nodes, and edges
- Secure access with Row Level Security

### API Endpoints

#### Public Endpoints
- `POST /api/analyze` - Start analysis (works with or without authentication)
- `GET /api/analysis/{id}/status` - Get analysis status
- `GET /api/analysis/{id}` - Get analysis results
- `GET /api/health` - Health check

#### Authenticated Endpoints
- `GET /api/user/analyses` - Get user's saved analyses
- `DELETE /api/analysis/{id}` - Delete user's analysis

## Database Schema

### Tables

#### `profiles`
- User profile information
- Automatically created when users sign up

#### `analyses`
- Analysis metadata and status
- Links to the user who created it
- Stores progress, file counts, and results metadata

#### `analysis_nodes`
- Individual file nodes from the dependency graph
- Includes file information, language, role, etc.

#### `analysis_edges`
- Dependency relationships between files
- Import types and connection metadata

## Security

The application uses Supabase's Row Level Security (RLS) to ensure:
- Users can only access their own analyses
- All data operations are scoped to the authenticated user
- Service role operations are used for backend admin tasks

## Development

To start the application:

### Backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm run dev
```

## Troubleshooting

### Common Issues

1. **Authentication errors**: Verify your Supabase URL and keys are correct
2. **Database errors**: Ensure the migration script has been run successfully
3. **CORS issues**: Make sure your frontend domain is added to Supabase authentication settings

### Supabase Dashboard

Use the Supabase dashboard to:
- Monitor user registrations
- View stored analysis data
- Check authentication logs
- Manage database tables

## Next Steps

Consider adding:
- Email confirmation for user registration
- OAuth providers (Google, GitHub, etc.)
- Analysis sharing between users
- Analysis history and versioning
- Export functionality for analysis results