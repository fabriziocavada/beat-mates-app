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
- Live Lesson Flow: Student requests > Teacher accepts > Video call starts (Daily.co).
- Availability System: Calendar with interactive time picker + real-time toggle.
- Video & Camera: Vertical video recording (max 10s) for posts/stories.
- Design: Dark theme, coral accent (#FF6978), "BEAT MATES" branding, 6-icon tab bar.
- Notifications: Real-time lesson request alerts with sound/vibration.

## Tech Stack
- Frontend: React Native (Expo), TypeScript, Zustand, Expo Router, react-native-webview
- Backend: Python, FastAPI, httpx
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via WebView)
- Media: Images via file upload/static serve. Videos via ffmpeg > base64 data URL.

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
    │   ├── (main)/     # home, profile, create-post, reels, calendar, video-call, etc.
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
- Availability calendar with INTERACTIVE time picker (arrows up/down)
- Live session request/accept/reject flow
- **VIDEO CALL via Daily.co** - WebView-based, room created on accept
- Lesson request notification banner (visual + sound + vibration)
- File upload with ffmpeg video conversion
- 6-icon tab bar navigation
- Splash screen

## Video Call Flow (NEW - Feb 28, 2026)
1. Student requests lesson (POST /live-sessions/request)
2. Teacher sees notification, goes to lesson-requests page
3. Teacher accepts → Backend creates Daily.co room → Returns room_url
4. Student polls session status → Sees "active" → Navigates to video-call
5. Both users load Daily.co room in WebView (works in Expo Go!)
6. Either user can end call → Room deleted, session marked "completed"

## API Endpoints (all prefixed /api)
- Auth: POST /auth/register, /auth/login
- Users: GET/PUT /users/me, GET /users/{id}, POST /users/{id}/follow
- Posts: GET/POST /posts, POST /posts/{id}/like, /posts/{id}/comments
- Stories: GET/POST /stories
- Categories: GET /dance-categories
- Teachers: GET /available-teachers
- Sessions: POST /live-sessions/request, /accept, /reject, /end; GET /live-sessions/{id}
- **Video Call: POST /video-call/create-room, /video-call/token, /video-call/end/{room}**
- Bookings: GET/POST /bookings
- Media: POST /upload, GET /media/{filename}

## Bug Fixes - Feb 28, 2026
- FIXED: React hooks order in ReelVideoPlayer (removed useRef/extra useEffect, simplified to 3 hooks)
- FIXED: Calendar time picker now interactive (up/down arrows for hours, minute toggle)
- FIXED: Profile video thumbnails use RN-compatible components
- FIXED: Missing VideoPlayer component in PostCard.tsx
- FIXED: Video-call endpoints placed before app.include_router()

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## 3rd Party Integrations
- Daily.co (API key in backend/.env)
- expo-av (video playback)
- expo-image-picker
- react-native-webview (video call)
- ffmpeg (server-side video conversion)

## Pending/Upcoming Tasks
### P1  
- Teacher-set lesson prices UI
- Post/Story video recording from camera

### P2
- Verify video playback on mobile (expo-av with base64 data URLs)
- Availability calendar improvements

### P3/Backlog
- Mock payment flow (Stripe/PayPal)
- Google social login
- Dedicated "Music" page
- Like/Follow improvements
- Code refactoring (split server.py)
