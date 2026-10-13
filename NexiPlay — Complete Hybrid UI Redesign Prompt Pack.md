# NexiPlay — Complete Hybrid UI Redesign Prompt Pack

**Source basis:** `NexiPlayApp.zip`-এর Kotlin/Jetpack Compose source, navigation, screen files, reusable components, theme, data models ও asset inventory পর্যালোচনা করে তৈরি।

## 1. Design direction

NexiPlay একটি Android entertainment app—movies, anime, series, novels, streaming, downloads, coins/rewards, watchlist, comments, notifications, AI assistant এবং profile/account management একসাথে আছে। Redesign-এ তিনটি visual language একসাথে ব্যবহার করতে হবে, কিন্তু যেন তিনটি আলাদা theme-এর মতো না লাগে:

- **Glassmorphism = primary system:** transparent/translucent surfaces, background blur, soft white borders, layered depth, cinematic poster imagery.
- **Claymorphism = interaction language:** rounded tactile CTA, active tab, selected chips, coin/reward cards, avatar actions, soft inflated buttons.
- **Neumorphism = utility/depth language:** very subtle raised/inset fields, segmented controls, player controls, settings rows, reader controls.

**Important:** do not make every element glossy, puffy or blurry. Keep hierarchy clear: content and poster imagery first, controls second, decoration third.

---

## 2. Master prompt — paste this first

```text
Redesign the complete Android entertainment app “NexiPlay” from the attached source/reference. Preserve the existing information architecture, route behavior, content hierarchy, labels, metadata, action names, episode/season logic, streaming/server logic, coin/reward logic, novel reading flow, profile menus and every existing user journey. Do not invent unrelated features.

Create a premium cinematic hybrid UI system combining:
1) Glassmorphism as the foundation: translucent dark glass panels, 16–28dp corner radius, 1px white borders at 8–18% opacity, controlled background blur, layered poster-image ambience, soft specular highlights.
2) Claymorphism for tactile interaction: rounded inflated red primary buttons, selected pills, reward/coin widgets and active navigation states with soft inner highlights and restrained shadows.
3) Neumorphism for utility controls: subtle raised/inset search fields, settings rows, player buttons, reader controls and segmented options using low-contrast shadows; never use harsh or plastic-looking bevels.

Brand: NexiPlay. Core palette: near-black navy #0B0D16, deep violet charcoal #141625, crimson red #E51D48, darker red #A70F35, white #F7F8FC, secondary lavender-gray #A7AABD, success green #28D391, coin gold #F6C453, error #EF4444. Use Inter for the general app UI; use Plus Jakarta Sans/Outfit/JetBrains Mono accents on the Coins Center where appropriate. Keep text high contrast and readable.

Design for Android phone first, 360–430dp width, with edge-to-edge status/navigation safe areas. Use a consistent 8dp spacing grid, 44–52dp touch targets, 3-column poster grid, 16dp screen gutters, 12–16dp card gaps, 56–64dp bottom navigation. Use real poster/banner image placeholders with image-aware gradients; never use random unrelated stock photography.

Every screen must include realistic loading shimmer, empty state, error/retry state, logged-out state where relevant, disabled state, pressed state, focus state and dark-mode contrast. Animations: 180–300ms spring/fade, hero parallax, horizontal pager motion, subtle glass highlight movement, no distracting looping effects. Accessibility: scalable text, WCAG-like contrast, content descriptions for all icons, large touch targets, do not rely on color alone.

Icons: preserve the functional meaning of all existing icons and custom SVG/vector assets. Use a consistent 2px rounded-line icon family. Do not replace icons with emoji except for existing semantic content labels such as Trending, 18+, coin or reader accents. Required functional icon set includes Home, Browse/Explore, Novels/Book, Coins/Diamond, Profile/Person, Search, Notifications, Back, Close, Play, Bookmark/BookmarkBorder, Trailer/Movie, Share, Download, Delete, Settings, History, Comments, Watchlist, Leaderboard/Trophy, Login/Logout, Edit, Camera, Send, Chat, Info, Error, Refresh, Volume, Brightness, Lock, Fullscreen, Fit/Aspect Ratio, Speed, Previous/Next and Chevron controls.

Output high-fidelity UI mockups, not low-fidelity wireframes. Show realistic content cards with title, type, year, running status, episode/season information, adult badge where applicable, poster/banner imagery, streaming availability, buttons and navigation. Maintain one coherent visual system across all screens.
```

---

## 3. Global shell prompt

```text
Design the NexiPlay app shell as a dark cinematic glass environment. Background is a near-black navy-to-violet gradient with extremely subtle blurred red/violet ambient blobs, never a flat black canvas. Add a translucent bottom navigation dock with five items: Home, Browse, Novels, Coins, Me. The dock has a frosted glass surface, thin white top edge, soft shadow and safe-area padding. Selected item uses NexiPlay crimson plus a small clay-like glowing pill/indicator; unselected items use muted lavender-gray. Labels remain visible below icons.

On all main bottom-nav screens, place the floating AI chatbot action at bottom-right: a 50dp crimson clay-glass circular button with chat icon, white rim highlight and a small green online indicator. Include a compact “Need help? Chat with me!” glass tooltip only on first/coach-mark state, not permanently in every screenshot.

Support global notices in six visual forms without breaking the shell: inline card, top-bar notice, bottom-bar notice, marquee strip, toast and full-screen/popup notice. Each notice uses a glass container, dismiss icon, optional image/video thumbnail, configurable background/text color and clear hierarchy. Include update dialog, coin upsell dialog and generic retry/error component in the same design language.
```

---

# 4. Primary screen prompts

## 4.1 Home / Discover

```text
Create the NexiPlay Home screen. Top bar: crimson NexiPlay wordmark on the left, Search and Notifications icons on the right, notification badge when unread. Below, a 420dp cinematic auto-sliding hero banner using a real movie/anime backdrop, dark bottom gradient and left-side vignette. Overlay type badge, 18+ badge only when applicable, release year, large two-line title, two-line description, primary clay-glass “Watch” button with play icon and secondary “More Info” button.

Below hero: horizontal “Latest Updates” section with compact poster/update cards and episode metadata; then “Upcoming” cards with release date/status; then horizontal rows for “Trending Now”, “Recent Movies”, “Recent Anime”, and “Recent Series”. Use 16dp gutters, poster cards with rounded 12–16dp corners, glass metadata chips and small red/green status indicators. Add pull-to-refresh affordance.

States: full shimmer for top bar/hero/rows; API error card with retry; empty sections should collapse gracefully; inline admin notice above hero; adult content badge and NSFW preference should be visually clear but not dominant. Use poster-aware gradients, not generic gradients.
```

## 4.2 Browse / Catalog

```text
Create the NexiPlay Browse screen. Header says “Browse” with Search action. Under it, a horizontally scrollable glass/clay segmented tab row: All, Movies, Anime, Series, Running. Selected tab is an inflated crimson pill with white bold text; unselected tabs are translucent neumorphic pills with muted text.

Main content is a 3-column poster grid. Each card has 0.68 aspect ratio, rounded 12dp corners, poster image, subtle glass overlay, type/adult/running badges and title below with ellipsis. Use lazy infinite-scroll behavior: when loading more, show three shimmer cards at the bottom. Keep grid aligned and dense but breathable.

States: initial 12-card shimmer grid, no-content state with search/discovery illustration, error/retry card, loading-more state, selected tab animation, pressed card scale-down and focused card border. Maintain the same bottom navigation and chatbot FAB.
```

## 4.3 Search

```text
Create the NexiPlay Search screen as a focused full-screen utility surface. Top row has Back icon and a large glass search field with leading Search icon, placeholder “Search movies, anime, series...”, animated crimson focus border, cursor, clear icon and keyboard-search affordance. Below, show results in the same 3-column poster grid as Browse.

Before searching show a calm empty discovery state. While searching show 9 shimmer cards. If no results, show a minimal magnifying-glass illustration and the exact dynamic message “No results found for “{query}””. If the request fails, show a glass error card with Retry. Keep the background less decorative than Home so the search field and results dominate.
```

## 4.4 Content Detail / Movie-Series-Anime Detail

```text
Create a cinematic NexiPlay content detail screen. Full-width 280dp hero banner with poster-aware crop, bottom fade into the app background and translucent back button at top-left. Below the hero, a floating 80x120dp poster overlaps the hero edge. Beside it show title, release year, type, language and green RUNNING status when applicable.

Action row: large crimson clay-glass Watch button with play icon only when streaming is available; glass/neumorphic Save or Saved bookmark button; Trailer button when a trailer exists. Then sections: Description with expandable Read more/Show less, genre/cast/language metadata chips, seasons selector for series/anime, episode list with episode number/title/status, available server/source selector, download links when available, related/recommended content and comments section.

Make streaming availability explicit but elegant: available servers as selectable glass chips, unavailable/disabled streaming as muted state, ad/premium upsell as a contained dialog rather than an intrusive overlay. Preserve adult badge, admin notice, pinned notice and episode auto-next context.

States: full detail shimmer, content-not-found screen with sad illustration and Go Back, empty episodes, unavailable server, selected episode, selected season, watchlist saved/unsaved, trailer loading, comments login prompt/no-comments/loading/error.
```

## 4.5 Player / Watch experience

```text
Create two connected NexiPlay playback states.

A) Player screen: true fullscreen landscape black video canvas using a real 16:9 video placeholder. Controls appear on tap and auto-hide after 4 seconds. Top glass control bar: back, content title, lock, settings. Center controls: 10-second rewind, play/pause, 10-second forward. Bottom glass control bar: seek slider, current/total time, volume, brightness, fit/aspect-ratio, speed, fullscreen. Double-tap left/right skip zones, vertical left brightness gesture and right volume gesture. Show small transient HUD cards for brightness/volume, “-10s/+10s” skip badges, aspect label and speed modal. Lock mode hides all except unlock affordance.

B) Watch/WebView screen: portrait-first streaming page with top bar back/title, large embedded player/WebView panel, server/source selector chips, season dropdown, episode horizontal list/grid, previous/next episode controls, download action and safe ad-blocked/error state. Preserve auto-next countdown overlay at the end of an episode and allow the user to cancel or play next. Show server error as “Server error. Try another server.” in a glass retry panel.

Player visual language: black canvas first, controls use 75–88% translucent glass, red progress, white controls, subtle neumorphic circular buttons. Never cover subtitles or video content unnecessarily.
```

## 4.6 Profile / Me

```text
Create the NexiPlay Profile screen. For logged-in users, show an elevated glass/clay profile header with avatar, edit-camera affordance, display name, email, VIP/Elite badge when present, referral code/ad-free status and a subtle red/violet halo. For guests, show a centered avatar placeholder, “Guest User”, “Login to access all features”, crimson Login and outlined Register buttons.

Below header, use grouped translucent menu cards with clear icons and chevrons: Leaderboard, Watchlist, Watch History, Downloads, My Comments, Request Content, Settings, Contact Us and Logout. Each row is a soft neumorphic/glass surface with 52–60dp height, secondary description where the source has one, pressed state and optional badge. Keep divider hierarchy subtle.

Include loading shimmer skeleton, avatar upload progress, edit-name dialog, logged-out state, network/error toast and confirmation dialog for logout if applicable. Keep bottom navigation visible on Profile.
```

---

# 5. Secondary screen prompts

## 5.1 Coins Center

```text
Design a premium rewards dashboard called Coins Center. Use a slightly warmer dark violet background. Hero Balance card: large animated coin balance, gold coin emblem, “TOTAL BALANCE”, Earned and Spent mini cards with green/red trend icons. Use gold glass with restrained clay depth, not a casino aesthetic.

Below: daily streak/calendar card with flame accent and claim state; invite friends/referral card with copy/share action; Earn Coins section with watch/ad/task rows and progress/loading/error states; Coin Shop with glass rows for Ad-Free 24h, Ad-Free 7d and Priority Request, each showing cost, description and purchase CTA. Logged-out state is a glass login-required card. Purchase success is a centered gold-accent dialog; failed purchase is a clear error state.
```

## 5.2 Novels / Novel detail / Reader

```text
Design the Novels tab with the same 3-column poster/card grammar, but use book-cover imagery, Book icon and a quiet violet accent. Header includes title, search field and pagination controls. Novel card shows cover, status, title, author/genre metadata.

Novel Detail: banner/cover header, back button, title, author, genre, status, chapter count, Start Reading clay button, description and searchable chapter list with chapter numbers/titles.

Novel Reader: distraction-free paper-like dark glass reading surface, compact top bar with novel title/chapter and back, readable text column, font-size/theme controls, previous/next chapter buttons, loading/error/retry state and “chapter not found” state. Keep reader controls neumorphic and minimal.
```

## 5.3 Auth — Login and Register

```text
Create Login and Register screens as focused glass authentication panels on the dark cinematic background. Include back button, NexiPlay mark, short welcome copy, clear outlined/glass fields, password visibility icon, crimson primary action, loading state, inline error banner and keyboard-safe layout.

Login fields: email and password, Login CTA, Forgot password dialog with email field and Send Link, link to Register. Register fields: display name, email, WhatsApp number, password, Register CTA and link back to Login. Error states must be concise, accessible and never shift the entire layout dramatically.
```

## 5.4 Notifications

```text
Create Notifications screen with glass top app bar: back, “Notifications”, Clear All action. Use stacked notification cards with icon/type accent, title, body, timestamp, unread red dot and Mark as Read button. Read cards are less bright but still legible. Empty state says “No Notifications” with a quiet bell illustration. Include loading skeleton, not-logged-in state, clear-all confirmation and retry error.
```

## 5.5 Watchlist, History, Downloads, Comments

```text
Create four consistent profile sub-screens.
Watchlist: top bar “My Watchlist”, 3-column movie grid, empty state “No Saved Content” and helper “Tap the bookmark icon on any content to save it here”.
History: top bar “Watch History”, vertical glass history cards with poster, title, type/episode/date and delete action; empty state “No Watch History”.
Downloads: top bar “My Downloads”, tabs App Downloads and Device Videos, progress cards with quality, size, progress, Play/Cancel/Delete, complete and failed states; device videos show duration, size and date.
Comments: top bar “My Comments”, vertical comment cards with title/content/date, empty state, loading shimmer and error/retry.
Use the same glass cards, icon weights, 16dp gutters and top-bar grammar in all four screens.
```

## 5.6 Leaderboard

```text
Create a social leaderboard screen with a glass podium for ranks 1–3, circular avatars, crown/rank colors, coin totals, watched count, Elite/VIP badges and a scrollable Top 15 list. Use gold/silver/bronze only for rank semantics; do not make the whole screen gold. Include animated avatar entrance, current-user emphasis, offline state “Leaderboard Currently Offline”, loading shimmer and empty/error states.
```

## 5.7 Settings, Request Content, Contact Us

```text
Settings: glass top bar “Settings”; grouped rows for Account & Security, Content, Downloads and About. Include email/password/WhatsApp edit rows, Hide NSFW Content switch with explanation, download location Change and Reset controls, Terms/Privacy links, and glass AlertDialogs for editing fields. Use neumorphic inset controls and red switch thumb/track only for active state.

Request Content: top bar, heading “What do you want to watch?”, explanatory copy, title field, Movie/Anime/Series selector pills, optional notes field, Submit Request button, loading ad state, inline error and success panel “Request Submitted! We’ll try to add it soon”.

Contact Us: top bar, Name, Email, Subject dropdown, Message field and Submit button. Preserve validation, submitting and success/failure toast states.
```

## 5.8 AI Chatbot

```text
Create NexiPlay’s AI assistant screen as a dedicated dark glass chat workspace. Header uses crimson-to-dark-red glass gradient, back button, circular NexiPlay bot avatar, bot name “NexiBot AI”, SMART AI badge, green online dot, rotating helper subtitle and delete-history icon. Message list uses distinct user and bot bubbles; bot content cards can show poster, title, type, year, synopsis and tap-to-open content detail. Streaming/typing state shows step indicator cards.

Bottom composer is a frosted/neumorphic panel with “Ask anything or search content...” field, crimson Send button when text exists, disabled state while typing and tiny disclaimer “AI can make mistakes. Please verify information.” Include clear-chat confirmation dialog, API error message, empty welcome state and keyboard-safe navigation.
```

---

# 6. Component-level prompt

```text
Create a reusable component library for this NexiPlay redesign:
- PosterCard: image, gradient, title, type/year, adult/running badge, pressed/focused state.
- HeroBanner: backdrop, parallax, bottom/side gradients, badges, title, description and CTA.
- GlassTopBar: title/back/actions/badges with safe-area handling.
- GlassBottomNav: five destinations, selected clay pill, labels and accessibility descriptions.
- GlassButton: primary crimson, secondary translucent, outline, disabled, loading and pressed variants.
- GlassChip: selected/unselected/error/success/gold states.
- GlassTextField: focused, error, disabled, password, search and clear variants.
- ShimmerBox/GridSkeleton/ListSkeleton: consistent loading motion and corner radii.
- EmptyState, ErrorState, RetryButton, InlineNotice, ToastNotice, PopupNotice, FullscreenNotice.
- EpisodeCard, SeasonSelector, ServerSelector, DownloadItem, NotificationCard, CommentCard, ProfileMenuRow.
- CoinBalanceCard, StreakCalendar, CoinShopRow, PurchaseDialog.
- PlayerControlButton, PlayerControlBar, GestureHUD, AutoNextOverlay.

Each component must have light/dark contrast-safe tokens even if the default app is dark, consistent 44dp minimum hit area, semantic content description and no accidental text clipping.
```

---

# 7. Exact screen/state checklist

Use this checklist when generating mockups or implementing the redesign:

- [ ] Splash: logo, dark ambient background, loading/progress transition, route to Home.
- [ ] Home: loading, error/retry, inline notice, hero, updates, upcoming, trending, recent rows, pull-to-refresh.
- [ ] Browse: All/Movies/Anime/Series/Running tabs, grid, shimmer, infinite loading, empty.
- [ ] Search: autofocus, focus border, query, results, shimmer, no result, error.
- [ ] Detail: loading, not found, hero, poster, metadata, Watch, Save, Trailer, description, seasons, episodes, servers, downloads, related, comments.
- [ ] Watch: episode/server selection, WebView/player loading, blocked/ad-safe state, retry, fullscreen, auto-next.
- [ ] Player: landscape, controls visible/hidden, seek, play, skip, volume, brightness, speed, aspect, lock, ended overlay.
- [ ] Novels: list, search, pagination, empty/error; detail; chapter reader; previous/next/error.
- [ ] Coins: logged-out, balance, earned/spent, streak, invite, earn, shop, purchase success/failure.
- [ ] Profile: guest, logged-in, avatar upload, edit name, VIP/Elite, menu rows, logout.
- [ ] Notifications: unread/read, mark read, clear all, empty/error.
- [ ] Watchlist: content grid, empty/error.
- [ ] History: event list, delete, empty/error.
- [ ] Downloads: app/device tabs, progress, complete, failed, play/delete.
- [ ] Comments: list, empty/error, comment/login prompt.
- [ ] Leaderboard: podium, top 15, badges, offline/empty/error.
- [ ] Settings: account security, NSFW switch, download location, about links, edit dialogs.
- [ ] Request Content: title/type/notes, ad/loading, validation, success.
- [ ] Contact Us: fields, dropdown, validation, submitting, success/failure.
- [ ] Login/Register: fields, password visibility, error, loading, reset password.
- [ ] AI Chatbot: header, messages, content result card, typing steps, composer, clear history.
- [ ] Global: update dialog, coin upsell, all notice types, ad/loading placeholders, network errors.

---

# 8. Negative prompt / quality guardrails

```text
Avoid generic Netflix clone styling, flat Material 3 defaults, pure white backgrounds, excessive neon, excessive blur that reduces readability, oversized pill-everything UI, childish cartoon styling, random stock imagery, inconsistent icon styles, tiny touch targets, illegible low-contrast gray text, accidental gradient banding, clipped titles, duplicate bottom navigation, unnecessary emoji, floating controls covering subtitles, fake statistics, fake server URLs, and redesigns that remove existing NexiPlay features or routes.
```

## Recommended generation order

1. Generate the **Global Shell + Home + Browse + Detail** first to lock the visual language.
2. Generate **Search + Watch/Player + Profile + Coins** second.
3. Generate the secondary screens using the same component library, not new styling.
4. Generate states separately: loading, empty, error, logged-out, dialog, pressed/focused and accessibility variants.
5. Before implementation, compare every screen against the source route checklist above so no existing flow, icon meaning or state is lost.
