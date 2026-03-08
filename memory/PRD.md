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

## VIDEOBUG Resolution (Critical Reference)
**Problem:** Videos from iPhones appeared black/unplayable in the app.
**Root Causes:**
1. `ffmpeg` CLI was not installed (only Python wrapper) → videos never re-encoded
2. iPhone HDR videos (H.264 High 10, 10-bit, yuv420p10le) incompatible with WebView `<video>`
3. Inline HTML WebView (`source={{ html }}`) had CORS/origin issues loading external video URLs
**Solution:**
1. Install `ffmpeg` CLI binary (`apt-get install ffmpeg`)
2. Always re-encode ALL uploaded videos to H.264 Main profile, 8-bit, yuv420p (web-compatible)
3. Created server-side `/api/video-player/{filename}` endpoint that serves HTML page (same origin as video)
4. Frontend WebView loads `source={{ uri: playerUrl }}` instead of inline HTML
5. `fit=auto` parameter: auto-detects horizontal vs vertical → contain vs cover
**If this happens again:** Check ffmpeg CLI availability, check video codec with `ffmpeg -i`, re-encode to yuv420p

---

## PRODUCTION READINESS CHECKLIST (Pre-Launch for 20,000 users)

### 🔴 P0 - CRITICAL (Blocking - Must fix before launch)

#### 1. MongoDB Indexes
- **Status:** NOT DONE
- **Impact:** App will freeze at ~500 users without indexes
- **Required indexes:**
  - `users`: email (unique), username (unique), id
  - `posts`: user_id, created_at (desc), type
  - `likes`: post_id + user_id (compound unique)
  - `comments`: post_id, created_at
  - `follows`: follower_id, following_id (compound unique)
  - `stories`: user_id, created_at
  - `messages`: conversation_id, created_at
  - `live_sessions`: student_id, teacher_id, status
  - `video_lessons`: user_id
  - `bookings`: student_id, teacher_id

#### 2. Cloud Storage (S3 + CDN)
- **Status:** NOT DONE
- **Impact:** Disk fills up in days with 20K users uploading videos
- **Solution:** Amazon S3 for storage + CloudFront CDN for fast delivery
- **Current:** Files stored locally in `/app/backend/uploads/` (148MB already)

#### 3. Rate Limiting
- **Status:** NOT DONE
- **Impact:** Server vulnerable to DDoS, brute-force attacks
- **Solution:** slowapi or similar - limit login (5/min), register (3/min), upload (10/min)

#### 4. JWT Secret from Environment
- **Status:** NOT DONE (hardcoded: 'beatmates-secret-key-2025-production-secure')
- **Impact:** Anyone who reads the code can forge tokens for any user
- **Solution:** Generate random 64-char secret, store in .env only

#### 5. Password Validation
- **Status:** NOT DONE (any password accepted, even "1")
- **Impact:** Accounts easily hacked
- **Solution:** Min 8 chars, require number + letter

#### 6. Stripe Payment Integration
- **Status:** MOCK payments only
- **Impact:** Can't charge real money for lessons/playlists
- **Solution:** Integrate Stripe for video lessons, premium playlists, and sponsorships

### 🟠 P1 - IMPORTANT (Before public launch)

#### 7. Email Verification
- **Status:** NOT DONE
- **Impact:** Fake accounts, spam
- **Solution:** SendGrid/Resend - send OTP or verification link on register

#### 8. Password Recovery
- **Status:** NOT DONE
- **Impact:** Users locked out forever if they forget password
- **Solution:** "Forgot password" flow with email OTP/link

#### 9. Report & Block System
- **Status:** NOT DONE
- **Impact:** No moderation = legal liability, toxic content
- **Solution:** Report post/user, block user, admin review queue

#### 10. Push Notifications
- **Status:** NOT DONE
- **Impact:** Low engagement without notifications for likes, comments, lesson requests
- **Solution:** Expo Push Notifications or Firebase Cloud Messaging

#### 11. Backend Refactoring
- **Status:** NOT DONE (server.py is 2300 lines monolith)
- **Impact:** Hard to maintain, debug, and deploy
- **Solution:** Split into APIRouter modules: auth, posts, stories, music, lessons, chat

#### 12. CORS Restriction
- **Status:** NOT DONE (allow_origins=["*"])
- **Impact:** Security vulnerability in production
- **Solution:** Restrict to app domains only

### 🟡 P2 - SPONSORSHIP SYSTEM (New Requirement - Launch Priority)

#### 13. Sponsored Posts / Boost System
- **Status:** NOT STARTED
- **How it works:**
  - User selects a post to "boost" (promote)
  - Sets budget (€5-€50), duration (1-7 days), target audience (dance categories)
  - Payment via Stripe
  - Post gets label "Sponsorizzato" in the feed
  - Feed algorithm injects sponsored posts between organic (1 every 5 organic posts)
  - Dashboard shows analytics: impressions, clicks, engagement rate
- **Database schema:**
  - `sponsorships` collection: post_id, user_id, budget, spent, duration_days, start_date, end_date, target_categories[], status (active/paused/completed), impressions, clicks
- **Algorithm:**
  1. Fetch organic posts (sorted by date)
  2. Fetch active sponsorships (budget > spent, end_date > now)
  3. Sort sponsorships by: remaining budget / impressions (higher ratio = less shown = priority)
  4. Insert 1 sponsored post every 5 organic posts
  5. Increment impression count, deduct cost (budget / target_impressions)
- **Frontend:**
  - "Promuovi" button on own posts
  - Campaign creation modal (budget slider, duration, category targeting)
  - Analytics dashboard (impressions chart, spend progress, engagement)
  - "Sponsorizzato" label on promoted posts in feed

### 🟢 P3 - POST-LAUNCH (Can do after initial launch)

#### 14. Google Social Login
#### 15. Real-time Chat (WebSocket)
#### 16. Admin Dashboard (moderation)
#### 17. Automatic Database Backups
#### 18. Production Deployment (Docker, AWS/OVH, CDN)

---

## Current Database Collections (19 collections)
availability_slots, bookings, comments, conversations, follows, likes, live_sessions, messages, playlist_subscriptions, playlists, posts, purchases, reviews, saved_posts, song_likes, songs, stories, users, video_lessons

## Key API Endpoints (70+ endpoints)
- Auth: register, login
- Users: me, search, follow, profile
- Posts: CRUD, like, save, comments
- Stories: create, list, view
- Live Lessons: request, accept, reject, end, review
- Music: playlists, songs, upload, genres
- Video Lessons: CRUD, reviews, purchase
- Chat: conversations, messages
- Media: upload, serve, thumbnail, video-player

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- DB: test_database on localhost:27017
