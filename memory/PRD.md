# BEAT MATES - Product Requirements Document

## Problem Statement
Social media mobile app for dancers called "BEAT MATES". Built with Expo (React Native) frontend and FastAPI/MongoDB backend.

## Core Requirements
- **User System:** Register/login (email+password). Google social login planned.
- **Dance Disciplines:** Multi-select. Feed filtered by disciplines.
- **Social Feed:** Instagram-like feed (photos, videos, text). Videos autoplay.
- **Comments & Likes:** Users can comment and like posts.
- **Stories:** Instagram-like 24h stories.
- **Profile:** Editable profile with picture upload.
- **Paid Lessons:** Live and pre-recorded dance lessons. Teachers set own prices.
- **Live Lesson Flow:** Student requests > Teacher accepts > Video call starts.
- **Availability System:** Calendar + real-time toggle.
- **Video & Camera:** Vertical video recording (max 10s) for posts/stories.
- **Design:** Dark theme, coral accent (#FF6978), "BEAT MATES" branding, 6-icon tab bar.
- **Notifications:** Real-time lesson request alerts with sound/vibration.

## Tech Stack
- **Frontend:** React Native (Expo), TypeScript, Zustand, Expo Router
- **Backend:** Python, FastAPI
- **Database:** MongoDB
- **Media:** Images via file upload/static serve. Videos via file upload > ffmpeg conversion > base64 data URL in API response.

## Architecture
```
/app
├── backend/
│   ├── uploads/        # Uploaded media files
│   ├── server.py       # All API routes
│   └── tests/
└── frontend/
    ├── app/
    │   ├── (auth)/     # login, register, categories
    │   ├── (main)/     # home, profile, create-post, reels, etc.
    │   └── _layout.tsx # Root layout with splash screen
    └── src/
        ├── components/ # PostCard, Header, TabBar, StoriesBar, etc.
        ├── services/   # api.ts (axios client, uploadFile, getMediaUrl)
        ├── store/      # authStore.ts (Zustand)
        └── constants/  # colors.ts
```

## What's Implemented (as of Feb 28, 2026)
- User registration & login (email/password)
- Dance category selection
- Social feed with posts (photo, video, text)
- Post creation with image/video upload
- Like & comment system
- Instagram-like stories (24h expiry)
- User profiles with post count, followers
- Follow/unfollow system
- Teacher availability toggle
- Live session request/accept/reject flow
- Lesson request notification banner (visual + sound + vibration)
- File upload with ffmpeg video conversion
- 6-icon tab bar navigation
- Splash screen with BEAT MATES logo
- Auto-refresh on feed

## API Endpoints (all prefixed /api)
- Auth: POST /auth/register, /auth/login
- Users: GET/PUT /users/me, GET /users/{id}, POST /users/{id}/follow
- Posts: GET/POST /posts, POST /posts/{id}/like, /posts/{id}/comments
- Stories: GET/POST /stories
- Categories: GET /dance-categories
- Teachers: GET /available-teachers
- Sessions: POST /live-sessions/request, /accept, /reject, /end
- Bookings: GET/POST /bookings
- Media: POST /upload, GET /media/{filename}

## Test Credentials
- mario@test.com / password123 (username: mario_dancer)

## Completed Bug Fixes (Feb 28, 2026)
- Fixed missing VideoPlayer component in PostCard.tsx (was causing crash)
- Fixed ReelVideoPlayer to handle base64 data URLs directly
- Added platform-specific video rendering (native HTML video on web, expo-av on mobile)
- Verified login works end-to-end (backend + frontend)
- All 24 API endpoints tested and passing (100%)

## Pending/Upcoming Tasks
### P0
- Implement functional Video Call (e.g., Daily.co integration)

### P1
- Teacher-set lesson prices UI
- Post/Story video recording from camera

### P2
- Availability calendar for future slots
- Verify Reels page functionality (video-only filter)

### P3/Backlog
- Mock payment flow (Stripe/PayPal)
- Google social login
- Dedicated "Music" page
- Like/Follow/Unfollow improvements
- Code refactoring (split server.py into routes/models)
