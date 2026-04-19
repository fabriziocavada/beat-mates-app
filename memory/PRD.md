# BEAT MATES - Product Requirements Document

## Overview
Social media mobile app for dancers built with Expo (React Native) + FastAPI + MongoDB.

## Core Features Implemented
- Authentication (Email/JWT)
- Social Feed with autoplay videos (audio cleanup on unmount)
- Stories (Instagram-like) with editor, background upload, thumbnail generation
- Reels (TikTok-style vertical scroll with expo-av)
- Search/Explore (Instagram grid + category chips + suggestions + video thumbnails)
- Direct Messaging
- User Profiles with grid + video thumbnails
- Video Calls via Daily.co (15 min limit, 60s pending timeout, busy status)
- Lessons System (Live/Group/Recorded)
- Bunny CDN for all media (global delivery including Asia)
- Background upload with progress banner (Instagram-style)

## Performance Architecture

### Upload Flow (Instagram-style)
1. User presses "Publish" → App returns to feed IMMEDIATELY
2. Banner shows "Pubblicazione storia/post..." 
3. Video sent to VPS `/api/upload` → compressed with ffmpeg (1080p, CRF 26) → uploaded to CDN
4. Thumbnail auto-generated from first frame
5. Banner shows "Pubblicato!" when done

### Video Calls (Robust system)
- Pending sessions auto-expire after 60 seconds
- Active sessions max 15 minutes (Daily.co room + DB)
- Teachers in call or with pending call = busy (red in list)
- Remaining minutes shown in teacher list
- Frontend polls every 2s while waiting for teacher to accept

### Media Delivery
- All media on Bunny CDN (beatmates-cd.b-cdn.net) with PoPs in EU, US, Asia
- Videos compressed server-side to 1080p/CRF26/H.264 Main
- Thumbnails: thumb_FILENAME.jpg convention on CDN
- getThumbnailUrl() resolves CDN thumbnails for video posts

## Deployment
- Backend: OVH VPS (api.beatmates.app) via Docker
- App: TestFlight (iOS) via EAS Build
- Database: MongoDB (production on VPS)
- CDN: Bunny CDN (beatmates-cd.b-cdn.net)

## Known Issues Fixed This Session
- Expo Go crash (missing expo-image-manipulator)
- Reels not playing (embed URLs → direct mp4)
- Search thumbnails black (now uses getThumbnailUrl)
- Profile thumbnails black (same fix)
- Story thumbnails black (ffmpeg first-frame extraction)
- Photos opening Reels (single tap now only for videos)
- Music stuck when changing pages (video unload on unmount)
- Video call "session not active" (polling + timeout)
- Upload taking 88s (background upload + optimized compression)
- Video quality too low (480p → 1080p)
- media_urls with stale embed URLs (admin fix endpoint)

## Next Tasks (Priority)
1. Stripe Connect for payments (80/20 split teachers)
2. Social Login (Google/Apple)
3. Push Notifications (APNs via Expo)
4. Admin Dashboard Web App
5. Story Editor improvements (text/sticker/drawing)
6. Refactor server.py into modular routers
