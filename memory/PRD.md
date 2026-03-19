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
- **Live Coaching Tool** (March 2026):
  - Teacher/student records/uploads 20s clip during live lesson
  - Shared review interface with video player (WebView-based)
  - Both users control: play/pause, seek, slow-motion (0.25x/0.5x/0.75x/1x)
  - SVG drawing overlay (bidirectional sync)
  - Color picker (5 colors), undo, clear drawings
  - State sync via polling (700ms)
  - Backend: 3 endpoints (upload, command, state) with MongoDB state store
  - Autoplay on video load (no black first frame)

## Available Teachers Feature
- Endpoint: GET /api/available-teachers
- Only returns users with `is_available: True`
- Real ratings from `reviews` collection (aggregation on reviewee_id)
- Includes review_count
- Busy teachers show `is_busy: true` with `remaining_minutes`
- Auto-closes stale sessions (>2 hours)
- Sorted: available first, then busy, rating descending

## VIDEOBUG Resolution (Critical Reference)
**Problem:** Videos from iPhones appeared black/unplayable in the app.
**Root Causes:**
1. `ffmpeg` CLI was not installed (only Python wrapper) -> videos never re-encoded
2. iPhone HDR videos (H.264 High 10, 10-bit, yuv420p10le) incompatible with WebView `<video>`
3. Inline HTML WebView (`source={{ html }}`) had CORS/origin issues loading external video URLs
**Solution:**
1. Install `ffmpeg` CLI binary (`sudo apt-get install -y ffmpeg`)
2. Always re-encode ALL uploaded videos to H.264 Main profile, 8-bit, yuv420p (web-compatible)
3. Created server-side `/api/video-player/{filename}` endpoint that serves HTML page (same origin as video)
4. Frontend WebView loads `source={{ uri: playerUrl }}` instead of inline HTML
5. `fit=auto` parameter: auto-detects horizontal vs vertical -> contain vs cover
**If this happens again:** Check ffmpeg CLI availability, check video codec with `ffmpeg -i`, re-encode to yuv420p

---

## PRODUCTION READINESS CHECKLIST (Pre-Launch for 20,000 users)

### P0 - CRITICAL (Blocking - Must fix before launch)

#### 1. MongoDB Indexes
- **Status:** DONE (46 indexes added)

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
- Backend Refactoring (server.py is 2400+ lines monolith)
- CORS Restriction

### P2 - SPONSORSHIP SYSTEM
- Sponsored Posts / Boost System (detailed spec in original PRD)

### P3 - POST-LAUNCH
- Google Social Login
- Real-time Chat (WebSocket)
- Admin Dashboard
- Automatic Database Backups
- Production Deployment
- Development Build migration (Expo Go -> native builds)

---

## Current Database Collections (20 collections)
availability_slots, bookings, coaching_sessions, comments, conversations, follows, likes, live_sessions, messages, playlist_subscriptions, playlists, posts, purchases, reviews, saved_posts, song_likes, songs, stories, users, video_lessons

## Key API Endpoints (73+ endpoints)
- Auth: register, login
- Users: me, search, follow, profile
- Posts: CRUD, like, save, comments
- Stories: create, list, view
- Live Lessons: request, accept, reject, end, review
- **Coaching: upload clip, send command, poll state**
- Music: playlists, songs, upload, genres
- Video Lessons: CRUD, reviews, purchase
- Chat: conversations, messages
- Media: upload, serve, thumbnail, video-player
- **Available Teachers: filtered, rated, with busy status**

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- Other: f.totti@roma.it / password123
- DB: test_database on localhost:27017

## Known Issues
- Carousel swipe on home feed: fix applied but USER VERIFICATION PENDING
- ffmpeg needs reinstall after environment restart (`sudo apt-get install -y ffmpeg`)
- Daily.co tunnel may disconnect intermittently (preview environment limitation)
- iPhone video autoplay regression in home feed (not addressed yet)
- One device shows a pause button at video call start (likely Daily.co rendering quirk)

## Recent Changes (Feb 2026 - Current Session)
- Coaching: Removed pink draw indicator dot (kept trash button in toolbar only)
- Coaching: Enabled video autoplay (no more black first frame)
- Coaching: **SYNC FIX** - Autoplay now sends `play` + `seek:0` to backend so other user auto-starts too
- Coaching: **CRITICAL FIX** - `isPlayingRef` now updated when remote state is applied via polling (was causing desync)
- Coaching: isPlayingRef synced on autoplay start
- Available Teachers: Fixed to only show users with is_available=True
- Available Teachers: Real ratings from reviews collection
- Available Teachers: Auto-close stale sessions (>2h)
- Available Teachers: Removed nonsensical timer, added proper busy/available status
- Available Teachers: Added status dot on avatar (green=available, red=busy)
- Video Call: Added auto-play for paused videos in Daily.co WebView (fixes play button on accepting device)
- Installed ffmpeg for video compression

## Previous Session Changes (March 10, 2026)
- Fixed video call UX issues (session persistence, coaching button, post-call navigation)
- WebView loading: 15s auto-timeout
- Auto-retry: 3 retries on network errors
- PiP layout: Animated dimensions, draggable with edge-snapping
- Drawing for BOTH users (bidirectional sync)
- Recording for BOTH users
- End-call confirmation dialog
- Fixed compress_video blocking event loop
- Added 46 MongoDB indexes
