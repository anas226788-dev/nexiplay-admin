# NexiPlay Vercel Environment Variables

> **Tips:** Vercel-এর Environment Variables পেজে গিয়ে আপনি নিচের পুরো কোড ব্লকটি কপি করে সরাসরি প্রথম ইনপুট বক্সে **Paste (Ctrl + V)** করলেই Vercel স্বয়ংক্রিয়ভাবে সবগুলো ভ্যারিয়েবল একসাথে আলাদা আলাদা করে বসিয়ে দেবে!

---

### এক ক্লিকে পেস্ট করার জন্য (Raw .env Format):

```env
NEXT_PUBLIC_SUPABASE_URL=https://ttgpplyunomwtqbgsupw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3BwbHl1bm9td3RxYmdzdXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjA5MTQsImV4cCI6MjA5MTI5NjkxNH0.8EVuBI_pN0dfpMFamh0szRqONSmDfWm4BNY5MGxL02g
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3BwbHl1bm9td3RxYmdzdXB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcyMDkxNCwiZXhwIjoyMDkxMjk2OTE0fQ.SZF4hb0y43TrUfdGjmoMJtiZ2JsN0HUweyOS4GojPIs
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3BwbHl1bm9td3RxYmdzdXB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcyMDkxNCwiZXhwIjoyMDkxMjk2OTE0fQ.SZF4hb0y43TrUfdGjmoMJtiZ2JsN0HUweyOS4GojPIs

NEXT_PUBLIC_SUPABASE_NOVELS_URL=https://lnpkqcvqsppaiafjtzpt.supabase.co
NEXT_PUBLIC_SUPABASE_NOVELS_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGtxY3Zxc3BwYWlhZmp0enB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjE0NjEsImV4cCI6MjA5MTI5NzQ2MX0.KjxXOCBnS5vQ7bt8_7tFIAC3dnbN7KCZjmF9qFI-YmE

STREAM_API_SECRET=nexiplay_rr_stream_encryption_key_2026_x7a9
TMDB_API_KEY=59957f2abf22d1588ca52253cf83b859
TMDB_NONCOMMERCIAL_USE_CONFIRMED=true

CRON_SECRET=nexi_cron_5f9a8b7c6d1e4023a1
REVALIDATE_SECRET=nexi_rev_b98e4f1a27c089d345
NEXT_PUBLIC_SITE_URL=https://nexiplay.vercel.app

ADMIN_PASSWORD=nexiplay_admin_secure_2026!
ADMIN_SESSION_SECRET=nexi_sess_7a3d9e2b1f8c054e8921
```

---

### বিস্তারিত বিবরণ ও তালিকা:

| Variable Name | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ttgpplyunomwtqbgsupw.supabase.co` | মেইন ডাটাবেজ URL (Movies, Series, Links) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | মেইন সুপাবেস পাবলিক কী |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | সার্ভার-সাইড ফুল পারমিশন কী |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | ফলব্যাক সার্ভিস কী |
| `NEXT_PUBLIC_SUPABASE_NOVELS_URL` | `https://lnpkqcvqsppaiafjtzpt.supabase.co` | উপন্যাস ডাটাবেজ URL (Golponir Novels) |
| `NEXT_PUBLIC_SUPABASE_NOVELS_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | উপন্যাস সুপাবেস কী |
| `STREAM_API_SECRET` | `nexiplay_rr_stream_encryption_key_2026_x7a9` | স্ট্রিমিং ও প্লেয়ার এনক্রিপশন সিক্রেট |
| `TMDB_API_KEY` | `59957f2abf22d1588ca52253cf83b859` | মুভি মেটাডাটা ও পোস্টার আনার কী |
| `TMDB_NONCOMMERCIAL_USE_CONFIRMED` | `true` | TMDB কনফার্মেশন ফ্ল্যাগ |
| `CRON_SECRET` | `nexi_cron_5f9a8b7c6d1e4023a1` | Cron Job সিকিউরিটি কী (cron-job.org) |
| `REVALIDATE_SECRET` | `nexi_rev_b98e4f1a27c089d345` | ক্যাশ রিভ্যালিডেশন সিক্রেট |
| `NEXT_PUBLIC_SITE_URL` | `https://nexiplay.vercel.app` | মেইন ওয়েবসাইটের URL |
| `ADMIN_PASSWORD` | `nexiplay_admin_secure_2026!` | অ্যাডমিন প্যানেল পাসওয়ার্ড |
| `ADMIN_SESSION_SECRET` | `nexi_sess_7a3d9e2b1f8c054e8921` | অ্যাডমিন সেশন এনক্রিপশন |
