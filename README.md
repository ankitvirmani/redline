# Redline

Production: https://redline-iota-eight.vercel.app

Redline reads a take-it-or-leave-it document, such as terms of service, a
subscription, a gym membership or an offer letter, and tells you what signing it
costs you.

## Production settings

The app reads four settings. Each one is set on Vercel, in the `redline` project's
Production environment, and in `.env.local` for running locally. Git ignores
`.env.local`, and no value is committed to this repository.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
