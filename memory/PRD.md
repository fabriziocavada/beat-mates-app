# BEAT MATES - Product Requirements Document

## Overview
Social media mobile app for dancers built with Expo (React Native) + FastAPI + MongoDB.

## Core Features Implemented
- Authentication (Email/JWT)
- Social Feed with autoplay videos
- Stories (Instagram-like) with editor
- Reels (TikTok-style vertical scroll with expo-av)
- Search/Explore (Instagram grid + category chips + suggestions)
- Direct Messaging
- User Profiles with grid
- Lessons System (Live/Group/Recorded)
- Bunny CDN for all media (images + videos)

## Performance Architecture

### Upload Flow (Instagram-style)
1. User presses "Publish" → App returns to feed IMMEDIATELY (background upload)
2. Video sent to VPS `/api/upload`
3. VPS compresses with ffmpeg (720p, ultrafast, CRF 32, baseline profile)
4. VPS generates thumbnail from first frame
5. VPS uploads compressed video + thumbnail to Bunny CDN
6. `/api/stories` or `/api/posts` creates the DB entry using CDN URLs

### Video Thumbnails
- `/api/upload` generates `thumb_FILENAME.jpg` on CDN
- `getThumbnailUrl()` in frontend resolves CDN thumb URL for video posts
- Profile grid, story circles, and search all use these thumbnails

### Media URLs
- All new media goes to Bunny CDN (`beatmates-cd.b-cdn.net`)
- `getDirectVideoUrl()` resolves any URL format to playable mp4
- `media_urls` array synced with `media` field (no stale embed URLs)

## Key Technical Decisions
- expo-av for video playback (expo-video doesn't work in Expo Go)
- No react-native-compressor (causes pod conflicts with React 19/SDK 54)
- No react-native-fast-image (same pod conflict)
- Background upload pattern for instant UX
- Server-side compression (720p, ultrafast preset) since client compression removed

## Deployment
- Backend: OVH VPS (api.beatmates.app) via Docker
- App: TestFlight (iOS) via EAS Build
- Database: MongoDB (production on VPS)
- CDN: Bunny CDN (beatmates-cd.b-cdn.net)

## Pending Issues
- Story Editor (text/sticker/drawing) - basic implementation exists
- Share Modal - not functional
- Hold-to-pause on Home Feed videos

## Next Tasks
- Stripe Connect for payments (80/20 split)
- Admin Dashboard Web App
- Push Notifications
- Google Social Login
- Refactor server.py into modular routers
