# BEAT MATES - Product Requirements Document

## Original Problem Statement
Social media mobile app for dancers called "BEAT MATES". Instagram-like experience with dance-specific features.

## Tech Stack
- **Frontend:** React Native (Expo), TypeScript, react-native-webview, Zustand
- **Backend:** Python, FastAPI, Motor (async MongoDB), ffmpeg
- **Database:** MongoDB
- **Video Calls:** Daily.co

## Core Features (Implemented)
- User auth (email/password, JWT)
- Social feed (posts with photos, videos, carousels)
- Stories (Instagram-like) + swipe-up reactions
- Likes, comments, saves + double-tap like (all media types)
- User profiles with post grid
- Follow/unfollow system
- Reels (vertical video feed)
- Music page (playlists, songs, speed controls)
- E-commerce: video lessons shop + info popup
- Live video lessons via Daily.co (1-to-1 + group with Zoom-like controls)
- Post-call rating system
- Direct messaging
- Coaching Review Tool (draw, undo last stroke, speed, sync)
- Available Teachers list with availability for single + group

## Performance Optimizations (March 2026)
- Video streaming: 8KB → 256KB chunks (32x faster)
- Cache headers: 1h → 24h
- Stories endpoint: N+1 → batch query
- Story thumbnail: blocking → async
- 8 MongoDB indexes on hot paths

## Notification System
Types: like, chat_message, lesson_booked, story_reaction, booking_confirmed, group_lesson_started

## Group Lessons
Zoom-like: owner tokens, hand raise, SOLO IO, mock payment

## Key Files
- `backend/server.py` - monolith (3000+ lines)
- `frontend/src/components/PostCard.tsx` - double-tap all media
- `frontend/src/components/CoachingReview.tsx` - undo fix
- `frontend/app/(main)/story/[id].tsx` - swipe reactions
- `frontend/app/(main)/group-video-call/[id].tsx`
- `frontend/app/(main)/profile.tsx` - lesson info popup
- `frontend/app/(main)/calendar.tsx` - lesson type selector

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123

## Completed Fixes (March 22, 2026)
- ✅ ffmpeg path fixed (all subprocess calls use `/usr/bin/ffmpeg`)
- ✅ All video stories + posts re-encoded to H.264 Main profile 8-bit yuv420p (iOS compatible)
- ✅ All video stories have thumbnails generated
- ✅ HEVC/10-bit videos converted to H.264 8-bit
- ✅ Large videos compressed (60MB → 13MB)
- ✅ New story upload flow: compress → thumbnail → save
- ✅ Video streaming with Range request (HTTP 206) for iOS
- ✅ Story viewer rewritten with horizontal FlatList pager (like Instagram)
- ✅ Swipe between users via native scroll + arrow buttons
- ✅ Stories support 60s per clip with auto-split for longer videos (backend)
- ✅ Existing long video stories split into 60s segments
- ✅ Home page video "play barrato" fixed (10-bit → 8-bit conversion)

## Known Issues
- ReviewsPopup carousel swipe (using arrows) - P0
- "i" icon too small on teacher card - P1
- 1-to-1 coaching video sync/loop bug - P2
- ngrok tunnel instability (infrastructure)

## Upcoming Tasks
1. Stripe integration (replace mock payments)
2. Push notifications (native)
3. Google Social Login
4. Deploy to OVH/AWS (Dockerfiles)
5. App Store / Play Store builds
6. Backend refactoring into modular routers
7. Sponsored posts system
