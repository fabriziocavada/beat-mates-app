# BEAT MATES - Product Requirements Document

## Overview
Social media mobile app for dancers built with Expo (React Native) + FastAPI + MongoDB.

## Core Features

### 1. Authentication
- Email/password login/register
- Google Social Login (pending)
- JWT token authentication

### 2. Social Feed
- Filterable by dance disciplines
- Autoplay videos with carousel support
- Like, comment, save functionality
- Share to stories feature (in progress)
- **NEW: Sponsored Ads integrated between posts (every 5 posts)**

### 3. Stories (Instagram-like)
**Completed:**
- View stories with horizontal FlatList swiping between users
- Progress bar timer (6s photos, 60s videos)
- Hold to pause functionality
- Swipe UP for reactions modal
- Swipe DOWN to close
- 3D cube transition effect
- Bottom bar with message input + icons
- Viewer section with animated reactions
- Full Story Editor with sidebar tools
- Text, Stickers, Effects, Drawing tools
- Overlay images (PNG/GIF on top of media)
- Music selection for stories
- Animated effects (falling hearts, rising stars, etc.)
- Pinch-to-zoom for main media
- Undo button for editor actions

**Fixed (Dec 2025):**
- Centered Text/Countdown/Question panels to avoid iPhone keyboard
- Improved overlay images upload with PNG/GIF support
- Added extensive logging for debugging uploads
- Fixed music list auto-loading when panel opens

### 4. Reels
- Vertical scrolling video feed
- Like, comment, share functionality

### 5. Direct Messaging (Chat)
- 1-to-1 conversations
- Real-time messaging
- Message from stories

### 6. User Profiles
- Grid of posts
- Shop tab for video lessons
- Follow/unfollow
- **NEW: "Sponsorizzate" menu item to manage ads**

### 7. Lessons System
**Live 1-to-1:**
- Video calls via Daily.co
- Coaching review tools

**Group Lessons:**
- Teacher schedules classes
- Multiple students join via Daily.co
- Payment integration

**Recorded Lessons:**
- Netflix-style tab with horizontal carousels
- Categories: Latino Americani, Ballroom, Caraibiche
- Each subcategory has lessons carousel
- 32 demo lessons created

### 8. Music Section
- Playlists
- Speed controls

### 9. Payments
- Stripe integration (pending real keys)
- Currently using mock payments

### 10. Notifications
- Push notifications (pending native integration)

### 11. Sponsorizzate/Ads System (NEW - Dec 2025)
**Backend:**
- `POST /api/ads` - Create new ad
- `GET /api/ads/my` - Get user's ads
- `GET /api/ads/packages` - Get pricing packages
- `GET /api/ads/serve/feed` - Serve ad for feed placement
- `GET /api/ads/serve/story` - Serve ad for story placement
- `GET /api/ads/serve/preroll` - Serve pre-roll ad for video lessons
- `POST /api/ads/{id}/click` - Track ad clicks
- `PATCH /api/ads/{id}` - Pause/resume ad
- `DELETE /api/ads/{id}` - Delete ad
- `GET /api/ads/stats/{id}` - Get ad statistics

**Pricing Packages (MOCK):**
| Package | Impressions | Price | Duration |
|---------|-------------|-------|----------|
| 🥉 Starter | 1,000 | €29 | 7 days |
| 🥈 Pro | 5,000 | €99 | 14 days |
| 🥇 Business | 20,000 | €299 | 30 days |
| 💎 Premium | 100,000 | €999 | 60 days |

**Ad Placements - FULLY INTEGRATED:**
- ✅ Feed: Between posts (every 5 posts) - `home.tsx` + `AdCard.tsx`
- ✅ Stories: Between user stories (every 3 users) - `story/[id].tsx` + `StoryAd.tsx`
- ✅ Pre-roll: Before video lessons (skip after 10 sec) - `lesson-player/[id].tsx` + `PrerollAd.tsx`

**Frontend Components:**
- `AdCard.tsx` - Instagram-style feed ad card
- `StoryAd.tsx` - Full-screen story ad with progress bar
- `PrerollAd.tsx` - YouTube-style pre-roll with skip button
- `sponsor.tsx` - Ad creation and management screen

## Technical Architecture

### Frontend (Expo/React Native)
```
/app/frontend/
├── app/(main)/
│   ├── home.tsx          # Feed with ads integration
│   ├── reels.tsx         # Reels viewer
│   ├── available.tsx     # Lessons (Live/Group/Recorded tabs)
│   ├── story/[id].tsx    # Story viewer (3D cube transitions)
│   ├── create-story.tsx  # Story creation + overlay upload
│   ├── sponsor.tsx       # NEW: Ad management screen
│   └── ...
├── src/components/
│   ├── InstagramStoryEditor.tsx  # Full Instagram-style editor (~2800 lines)
│   ├── AdCard.tsx        # NEW: Feed ad component
│   ├── StoryAd.tsx       # NEW: Story ad component
│   ├── PrerollAd.tsx     # NEW: Pre-roll video ad component
│   ├── PostCard.tsx      # Feed post card
│   └── ...
└── src/services/api.ts   # API client with uploadFile for PNG/GIF support
```

### Backend (FastAPI)
```
/app/backend/
├── server.py             # Main server (3300+ lines - needs refactoring)
└── uploads/              # Media storage
```

### Database (MongoDB)
Collections: users, posts, stories, story_reactions, conversations, messages, video_lessons, **ads**, **ad_clicks**, etc.

## Ad Schema
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "string",
  "media_url": "string",
  "media_type": "image|video",
  "link_type": "external|lesson",
  "link_url": "string",
  "link_text": "string",
  "placement": ["feed", "story", "preroll"],
  "package_id": "starter|pro|business|premium",
  "impressions_bought": 5000,
  "impressions_used": 234,
  "clicks": 18,
  "status": "active|paused|completed|pending",
  "created_at": "datetime",
  "expires_at": "datetime"
}
```

## Known Issues
- P2: ReviewsPopup carousel swipe broken (carried from previous sessions)
- P2: "i" Icon Size on Teacher card is too small

## Next Tasks (Priority Order)
1. P1: Integrate StoryAd between stories in story/[id].tsx
2. P1: Integrate PrerollAd before video lessons in available.tsx
3. P1: Stripe real integration
4. P2: ReviewsPopup carousel fix
5. P2: Google Social Login

## 3rd Party Integrations
- Daily.co: Video calls
- Expo Suite (expo-av, expo-router)
- FFMPEG: Video compression (server-side)

## Test Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
