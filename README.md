# Nexiplay - OTT Download Platform

A Bollyflix-style legal OTT website built with Next.js, Tailwind CSS, and Supabase.

## Features

- 🎬 Movies, Series & Anime listings
- 📥 Download system (no streaming)
- 🎨 Dark theme with modern UI
- 🔍 Genre-based filtering
- 📱 Fully responsive design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Language**: TypeScript

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Supabase credentials in `.env.local`

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   ├── movies/            # Movies listing
│   ├── series/            # Series listing
│   ├── anime/             # Anime listing
│   ├── genre/[slug]/      # Genre filter
│   └── [type]/[slug]/     # Content detail page
├── components/            # Reusable components
└── lib/                   # Utilities & Supabase client
```

## License

MIT
