# BEAT MATES - Product Requirements Document

## Problem Statement
Social media mobile app for dancers called "BEAT MATES". Built with Expo (React Native) frontend and FastAPI/MongoDB backend.

## Core Requirements
- User System: Register/login (email+password). Google social login planned.
- Dance Disciplines: Multi-select. Feed filtered by disciplines.
- Social Feed: Instagram-like feed (photos, videos, text). Videos autoplay.
- Comments & Likes
- Stories: Instagram-like 24h stories
- Profile: Editable profile with picture upload
- Paid Lessons: Live and pre-recorded dance lessons. Teachers set own prices.
- Live Lesson Flow: Student requests > Teacher accepts > Video call starts.
- Availability System: Calendar + real-time toggle.
- Video & Camera: Vertical video recording (max 10s) for posts/stories.
- Design: Dark theme, coral accent (#FF6978), "BEAT MATES" branding, 6-icon tab bar.
- Notifications: Real-time lesson request alerts with sound/vibration.

## Tech Stack
- Frontend: React Native (Expo), TypeScript, Zustand, Expo Router
- Backend: Python, FastAPI
- Database: MongoDB
- Media: Images via file upload/static serve. Videos via file upload > ffmpeg conversion > base64 data URL in API response.

## Architecture
```
/app
├── backend/
│   ├── uploads/
│   ├── server.py
│   └── tests/
└── frontend/
    ├── app/
    │   ├── (auth)/     # login, register, categories
    │   ├── (main)/     # home, profile, create-post, reels, calendar, etc.
    │   └── _layout.tsx
    └── src/
        ├── components/ # PostCard, Header, TabBar, StoriesBar, etc.
        ├── services/   # api.ts
        ├── store/      # authStore.ts
        └── constants/  # colors.ts
```

## What's Implemented
- User registration & login (email/password)
- Dance category selection
- Social feed with posts (photo, video, text)
- Post creation with image/video upload
- Like & comment system
- Instagram-like stories (24h expiry)
- User profiles with post count, followers
- Follow/unfollow system
- Teacher availability toggle
- Availability calendar with interactive time picker
- Live session request/accept/reject flow
- Lesson request notification banner (visual + sound + vibration)
- File upload with ffmpeg video conversion
- 6-icon tab bar navigation
- Splash screen

## Bug Fixes - Feb 28, 2026
- FIXED: React hooks order in ReelVideoPlayer (useRef/useEffect moved before conditional returns - was causing mobile crash)
- FIXED: Calendar time picker now interactive (up/down arrows for hours, minute toggle)
- FIXED: Profile video thumbnails use RN-compatible components (removed raw HTML video tag)
- FIXED: Missing VideoPlayer component in PostCard.tsx
- FIXED: ReelVideoPlayer handles base64 data URLs directly

## Test Credentials
- mario@test.com / password123

## Pending/Upcoming Tasks
### P0
- Implement functional Video Call (WebRTC integration, e.g. Daily.co)

### P1  
- Teacher-set lesson prices UI
- Post/Story video recording from camera

### P2
- Verify Reels page on mobile (video playback)
- Availability calendar improvements

### P3/Backlog
- Mock payment flow (Stripe/PayPal)
- Google social login
- Dedicated "Music" page
- Like/Follow improvements
- Code refactoring (split server.py)
