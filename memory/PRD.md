# BEAT MATES - Product Requirements Document

## Tech Stack
- Frontend: React Native (Expo SDK 54), TypeScript, Zustand, Expo Router, expo-video, react-native-webview
- Backend: Python, FastAPI, httpx
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via WebView)
- Media: Direct file serving via /api/media/ endpoint (no base64)

## What's Implemented
- User registration & login, dance categories, social feed, stories, profiles
- expo-video (replaced deprecated expo-av) for ALL video playback
- Videos served as direct MP4 files (not base64)
- Daily.co video call integration
- Interactive calendar time picker
- Lesson request notifications

## Changes - Mar 1, 2026
- MIGRATED from expo-av to expo-video (useVideoPlayer + VideoView) in ALL files
- Re-added missing /api/users/{user_id}/posts endpoint (accidentally deleted)
- Profile "+" stories button now navigates to create-story
- All videos autoplay, tap to pause
- Removed all expo-av imports from codebase

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## Pending Tasks
### P1
- Teacher-set lesson prices UI
- Post/Story video recording from camera

### P3/Backlog
- Payment flow (Stripe/PayPal), Google social login, Music page, refactoring
