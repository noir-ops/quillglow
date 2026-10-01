# QuillGlow Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- A Stripe account (test mode)
- API keys for Gemini AI and Deepgram

## Environment Variables Setup

1. Copy `.env.example` to `.env.local`:
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

2. Fill in the following environment variables:

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Site Configuration
- `NEXT_PUBLIC_SITE_URL`: Your site URL (use `http://localhost:3000` for local development)
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: Auth callback URL (use `http://localhost:3000/auth/callback` for local)

### AI Configuration
- `GEMINI_API_KEY`: Your Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Speech-to-Text Configuration
- `DEEPGRAM_API_KEY`: Your Deepgram API key from [Deepgram Console](https://console.deepgram.com/)

### Stripe Configuration
- `STRIPE_SECRET_KEY`: Your Stripe secret key (test mode: `sk_test_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (test mode: `pk_test_...`)
- `STRIPE_GENIUS_PRICE_ID`: Your Stripe price ID for the Genius plan (create in Stripe Dashboard)

## Database Setup

1. Run the SQL scripts in order in your Supabase SQL Editor:
   \`\`\`
   scripts/001_create_profiles.sql
   scripts/007_create_study_tables.sql
   scripts/008_create_study_plans.sql
   scripts/009_create_contact_messages.sql
   scripts/010_fix_contact_messages_rls.sql
   scripts/011_create_subscriptions.sql
   \`\`\`

2. The scripts will create all necessary tables and Row Level Security policies.

## Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Create a new product called "QuillGlow Genius"
3. Set the price to $4.99/month (recurring)
4. Copy the Price ID (starts with `price_...`)
5. Add it to your `.env.local` as `STRIPE_GENIUS_PRICE_ID`

## Installation

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features

- **Dashboard**: Today's Focus with streak tracking and task management
- **Study Planner**: Calendar view, Pomodoro timer, AI task suggestions
- **Flashcards**: Spaced repetition, quiz mode, AI generation
- **Smart Notes**: Rich text editor, voice-to-text, auto-save
- **Progress Analytics**: Study hours, subject breakdown, mood tracking
- **Subscription Plans**: Free (Scholar) and Paid (Genius) plans with Stripe integration

## Troubleshooting

### Stripe Checkout Not Working
- Ensure `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set in `.env.local`
- Verify the keys are from test mode (start with `sk_test_` and `pk_test_`)
- Check that `NEXT_PUBLIC_SITE_URL` is set correctly

### AI Features Not Working
- Verify `GEMINI_API_KEY` is set and valid
- Check the browser console for API errors

### Voice-to-Text Not Working
- Ensure `DEEPGRAM_API_KEY` is set and valid
- Check browser permissions for microphone access

### Database Errors
- Verify all SQL scripts have been run in order
- Check Supabase logs for RLS policy violations
- Ensure user is authenticated when accessing protected routes
