# BEAT MATES - Product Requirements Document

## Original Problem Statement
Social media mobile app for dancers called "BEAT MATES". Instagram-like experience with dance-specific features.

## Tech Stack
- **Frontend:** React Native (Expo), TypeScript, react-native-webview (video player), Zustand
- **Backend:** Python, FastAPI, Motor (async MongoDB), ffmpeg (video compression)
- **Database:** MongoDB
- **Video Calls:** Daily.co

## Core Features (Implemented)
- User auth (email/password, JWT)
- Social feed (posts with photos, videos, carousels)
- Stories (Instagram-like)
- Likes, comments, saves
- User profiles with post grid
- Follow/unfollow system
- Reels (vertical video feed)
- Music page (playlists, songs, speed controls)
- E-commerce: video lessons shop on profiles
- Live video lessons via Daily.co
- Post-call rating system
- Direct messaging (basic)
- User search with fuzzy matching
- Custom thumbnail selection for video posts
- Premium playlists (mock payments)
- Automatic video compression (ffmpeg, H.264 8-bit web-compatible)
- Server-side video player endpoint (`/api/video-player/{filename}`) with auto object-fit detection
- **Live Coaching Tool** (NEW - March 2026):
  - Teacher records/uploads 20s clip during live lesson
  - Shared review interface with video player (WebView-based)
  - Teacher controls: play/pause, seek, slow-motion (0.25x/0.5x/0.75x/1x)
  - SVG drawing overlay on video (teacher draws, student sees synced)
  - Color picker (5 colors), undo, clear drawings
  - State sync via polling (student polls every 600ms)
  - Backend: 3 endpoints (upload, command, state) with MongoDB state store

## VIDEOBUG Resolution (Critical Reference)
**Problem:** Videos from iPhones appeared black/unplayable in the app.
**Root Causes:**
1. `ffmpeg` CLI was not installed (only Python wrapper) -> videos never re-encoded
2. iPhone HDR videos (H.264 High 10, 10-bit, yuv420p10le) incompatible with WebView `<video>`
3. Inline HTML WebView (`source={{ html }}`) had CORS/origin issues loading external video URLs
**Solution:**
1. Install `ffmpeg` CLI binary (`apt-get install ffmpeg`)
2. Always re-encode ALL uploaded videos to H.264 Main profile, 8-bit, yuv420p (web-compatible)
3. Created server-side `/api/video-player/{filename}` endpoint that serves HTML page (same origin as video)
4. Frontend WebView loads `source={{ uri: playerUrl }}` instead of inline HTML
5. `fit=auto` parameter: auto-detects horizontal vs vertical -> contain vs cover
**If this happens again:** Check ffmpeg CLI availability, check video codec with `ffmpeg -i`, re-encode to yuv420p

---

## PRODUCTION READINESS CHECKLIST (Pre-Launch for 20,000 users)

### P0 - CRITICAL (Blocking - Must fix before launch)

#### 1. MongoDB Indexes
- **Status:** NOT DONE
- **Impact:** App will freeze at ~500 users without indexes

#### 2. Cloud Storage (S3 + CDN)
- **Status:** NOT DONE
- **Impact:** Disk fills up in days with 20K users uploading videos

#### 3. Rate Limiting
- **Status:** NOT DONE

#### 4. JWT Secret from Environment
- **Status:** NOT DONE (hardcoded)

#### 5. Password Validation
- **Status:** NOT DONE

#### 6. Stripe Payment Integration
- **Status:** MOCK payments only

### P1 - IMPORTANT (Before public launch)
- Email Verification
- Password Recovery
- Report & Block System
- Push Notifications
- Backend Refactoring (server.py is 2300+ lines monolith)
- CORS Restriction

### P2 - SPONSORSHIP SYSTEM
- Sponsored Posts / Boost System (detailed spec in original PRD)

### P3 - POST-LAUNCH
- Google Social Login
- Real-time Chat (WebSocket)
- Admin Dashboard
- Automatic Database Backups
- Production Deployment

---

## Current Database Collections (20 collections)
availability_slots, bookings, coaching_sessions, comments, conversations, follows, likes, live_sessions, messages, playlist_subscriptions, playlists, posts, purchases, reviews, saved_posts, song_likes, songs, stories, users, video_lessons

## Key API Endpoints (73+ endpoints)
- Auth: register, login
- Users: me, search, follow, profile
- Posts: CRUD, like, save, comments
- Stories: create, list, view
- Live Lessons: request, accept, reject, end, review
- **Coaching: upload clip, send command, poll state** (NEW)
- Music: playlists, songs, upload, genres
- Video Lessons: CRUD, reviews, purchase
- Chat: conversations, messages
- Media: upload, serve, thumbnail, video-player

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- DB: test_database on localhost:27017

## Known Issues
- Carousel swipe on home feed: fix applied but USER VERIFICATION PENDING
- ffmpeg needs reinstall after environment restart (`sudo apt-get install -y ffmpeg`)
- Daily.co tunnel may disconnect intermittently (preview environment limitation)

## Recent Changes (March 10, 2026 - Session 2)
- Fixed 8 video call UX issues:
  1. Session persistence: active session saved to AsyncStorage, TV tab reconnects
  2. Coaching button: bigger (44x44), round, well-spaced from end-call button
  3. Post-call: navigates to home (not back to random chat screen)
  4. WebView loading: 15s auto-timeout instead of infinite loading
  5. Auto-retry: 3 retries on network errors
  6. PiP layout: WhatsApp-style vertical box (same WebView, no duplicate connection)
  7. Drawing for both users: teacher AND student can draw on coaching video
  8. X closes coaching: returns to full-screen video call
- Added 46 MongoDB indexes for performance
- Installed ffmpeg for video compression
