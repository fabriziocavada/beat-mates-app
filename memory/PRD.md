# BEAT MATES - Product Requirements Document

## Tech Stack
- Frontend: React Native (Expo SDK 54), TypeScript, Zustand, Expo Router, react-native-webview, expo-av (audio only)
- Backend: Python 3, FastAPI, Uvicorn, motor (async MongoDB)
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via WebView)
- Thumbnails: ffmpeg (first frame extraction, cached as _thumb.jpg)
- Media: Direct file serving via /api/media/ and /api/uploads/ endpoints

## What's Implemented
- User registration & login (JWT), dance categories, social feed, stories, profiles
- Video playback via WebView with HTML5 <video> tag (DO NOT CHANGE)
- Videos served as direct MP4 files from /api/uploads/
- Daily.co video call integration (teacher + student flow)
- Interactive calendar time picker
- Lesson request notifications with vibration + audio (ring-ring sound)
- Profile story creation via "+" highlight button

## Changes - Mar 2, 2026 (Session 3)
- REWRITTEN: Story viewer with Instagram-like sequential playback, segmented progress bars, auto-advance, tap left/right navigation, swipe between users
- ADDED: Backend /api/thumbnail/{filename} endpoint - generates JPEG thumbnails from videos using ffmpeg with caching
- FIXED: Profile page now shows real user stories as highlights (was mock data with null images)
- FIXED: Profile post grid now shows actual video thumbnails instead of black play icons
- FIXED: Camera video capture now uses vertical aspect ratio (9:16) in create-post and create-story
- FIXED: Home stories bar navigates to /(main)/story/{userId} for proper multi-story viewing

## Changes - Mar 1, 2026 (Session 2)
- FIXED: Student-side video call polling bug (counter reset in useEffect)
- ADDED: Notification sound for lesson requests (expo-av native + AudioContext web)
- VERIFIED: Profile "+" story highlight button works

## Changes - Mar 1, 2026 (Session 1)
- Video playback migration to WebView
- Daily.co video calls integration
- Fixed critical login/profile bugs

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## Pending Bugs
### P2
- Reels page: only first video autoplays (viewability tracking needed)
- Home page: videos start only after navigating away and back

## Upcoming Tasks
### P1
- Teacher-set lesson prices UI (hourly_rate field exists in DB)
- Post/Story video recording from camera

### P2
- Availability calendar for future scheduling

### P3/Backlog
- Payment flow (Stripe/PayPal) - currently MOCKED
- Google social login
- Music page
- Like/Follow/Unfollow functionality
- Refactoring: cleanup test files in /app root

## External Services
- Daily.co: Video calls (API key in backend/.env)
- MongoDB: Database (MONGO_URL in backend/.env)
- ffmpeg: Video thumbnail generation (installed on server)

## Hosting Requirements (Production)
- 2 vCPU, 4GB RAM, 50GB SSD minimum
- Linux, Python 3.11+, Node.js 18+, MongoDB 6+, ffmpeg
- Recommended: DigitalOcean, AWS, Hetzner
- Apple Developer ($99/yr) + Google Play ($25) for app stores
