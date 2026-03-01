# BEAT MATES - Product Requirements Document

## Tech Stack
- Frontend: React Native (Expo SDK 54), TypeScript, Zustand, Expo Router, react-native-webview, expo-av (audio only)
- Backend: Python, FastAPI, httpx
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via WebView)
- Media: Direct file serving via /api/media/ endpoint (no base64)

## What's Implemented
- User registration & login, dance categories, social feed, stories, profiles
- Video playback via WebView with HTML5 <video> tag (DO NOT CHANGE)
- Videos served as direct MP4 files
- Daily.co video call integration (teacher + student flow)
- Interactive calendar time picker
- Lesson request notifications with vibration + audio (ring-ring sound)
- Profile story creation via "+" highlight button

## Changes - Mar 1, 2026 (Session 2)
- FIXED: Student-side video call polling bug - counter was resetting every render because waitTime was in useEffect dependencies. Split into two separate useEffects: countdown timer and polling.
- ADDED: Notification sound for lesson requests using expo-av on native (generated WAV beep) and AudioContext on web (880Hz ring-ring pattern)
- VERIFIED: Profile "+" story highlight button works correctly, navigates to create-story

## Changes - Mar 1, 2026 (Session 1)
- MIGRATED from expo-av to expo-video for ALL video playback
- Re-added missing /api/users/{user_id}/posts endpoint
- Profile "+" stories button navigates to create-story
- All videos autoplay, tap to pause
- Integrated Daily.co video calls

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
- Payment flow (Stripe/PayPal)
- Google social login
- Music page
- Like/Follow/Unfollow functionality
- Refactoring: cleanup test files in /app root
