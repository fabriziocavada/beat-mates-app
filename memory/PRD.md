# BEAT MATES - Product Requirements Document

## Original Problem Statement
Social media mobile app for dancers called "BEAT MATES" with:
- User registration/login (email + Google social login)
- Dance discipline selection with filtered feed
- Instagram-like social feed (photos, videos, text posts) with video autoplay
- Comments system
- Instagram-like stories
- Profile with picture updates
- Paid dance lessons (live and pre-recorded)
- Live lesson flow: student requests → teacher accepts → video call
- Availability system (calendar + real-time toggle)
- Vertical video recording (max 10 sec)
- Dark theme with coral accent (#FF6978)
- BEAT MATES splash screen
- 6-icon tab bar

## Architecture
- **Frontend:** React Native (Expo) running on web, TypeScript, Zustand, Expo Router
- **Backend:** Python, FastAPI
- **Database:** MongoDB
- **Media:** Server-side file upload system (`/api/upload` → `/api/uploads/` static serving)

## DB Schema
- `users`: {id, username, email, password, profile_image, dance_categories, is_available, hourly_rate, ...}
- `posts`: {id, user_id, type, media, caption, likes_count, comments_count, ...}
- `stories`: {id, user_id, media, type, expires_at, ...}
- `live_sessions`: {id, student_id, teacher_id, status, ...}
- `comments`: {id, post_id, user_id, text, ...}
- `follows`: {follower_id, following_id}

## What's Been Implemented
### Phase 1 (Previous sessions)
- Auth (login/register with email/username)
- 6-icon tab bar, splash screen
- Lesson request flow (student → teacher notifications)
- Reels page (TikTok-style video feed)
- Comments page
- Video call simulation
- Dance category selection

### Phase 2 (Feb 28, 2026)
- **CRITICAL FIX: Complete media pipeline refactor** - base64 → server-side file upload
  - Backend `/api/upload` endpoint with automatic QuickTime→H.264 video conversion (ffmpeg)
  - Backend `/api/media/{filename}` endpoint for streaming + base64 data URL delivery
  - Frontend `uploadFile()` helper (works on both web and native platforms)
  - Frontend `getMediaUrl()` for URL resolution + `WebVideo` component for video playback
  - Updated ALL components: PostCard, StoriesBar, TabBar, story viewer, comments, user profile, lesson requests, AvailableTeacherCard
  - Stories backend converts base64 to files automatically
  - Feed shows ALL posts (removed restrictive filter)
  - Stories show ALL non-expired stories
- **Notification Banner:** `LessonNotificationBanner` component with:
  - 5-second polling for pending lesson requests
  - Coral animated banner at bottom of screen
  - Sound alert (Web Audio API beep) + vibration on new requests
  - Visible on Home and Profile pages
- **Auto-refresh:** Home and Profile pages refresh on navigation via `usePathname`
- **Data cleanup:** Removed all broken old content, fresh database
- **Loading overlay:** "Pubblicazione in corso..." during post/story creation

## Test Results
- Backend: 20/20 passed (100%)
- Frontend: 95% (minor cosmetic issues only)
- Test file: `/app/test_reports/iteration_1.json`

## Test Credentials
All user passwords: `password123`
- mario@test.com / mario_dancer
- fabry, io, Veronica, Fabry

## Pending/Upcoming Tasks
### P0
- Video call PoC (real WebRTC - needs Agora/Daily.co/Twilio)

### P1
- Teacher-set lesson price UI (hourly_rate field exists in backend)
- Post/story video recording (camera → max 10 sec vertical)

### P2
- Availability calendar for teachers
- Notification improvements (sound, faster polling)

### P3 (Backlog)
- Payment flow (Stripe/PayPal)
- Google social login
- Music page
- Like/Follow/Unfollow
- Real-time WebSocket notifications
