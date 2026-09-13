# QuillGlow - AI-Powered Study Management App

A modern, beautiful study management application with AI-powered features to help students organize their learning journey.

## Features

- **Dashboard**: Track your study streak, view motivational quotes, and manage daily tasks
- **Study Planner**: Calendar view with Pomodoro timer and AI-powered study plan generation
- **Flashcards**: Spaced repetition system with AI-generated flashcards from your study materials
- **Smart Notes**: Rich text editor with Deepgram-powered voice-to-text input and auto-save
- **Analytics**: Track study hours, subject breakdown, GPA estimation, and mood tracking

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your credentials:

\`\`\`bash
cp .env.example .env.local
\`\`\`

3. Get your API keys:
   - **Supabase**: Create a project at [supabase.com](https://supabase.com)
   - **Gemini API**: Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Deepgram API**: Get your key from [Deepgram Console](https://console.deepgram.com/)

4. Install dependencies:

\`\`\`bash
npm install
\`\`\`

5. Run the database migrations in Supabase SQL Editor:
   - Execute scripts in order: `001_create_profiles.sql` through `008_create_study_plans.sql`

6. Start the development server:

\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

Required environment variables in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `NEXT_PUBLIC_SITE_URL`: Your site URL (http://localhost:3000 for development)
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: Auth redirect URL for development
- `GEMINI_API_KEY`: Your Google Gemini API key for AI features
- `DEEPGRAM_API_KEY`: Your Deepgram API key for voice-to-text transcription

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash via AI SDK
- **Speech-to-Text**: Deepgram API
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion + GSAP
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Charts**: Recharts

## License

MIT
