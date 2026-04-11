# BEAT MATES - Product Requirements Document

## Overview
Social media mobile app for dancers built with Expo (React Native) + FastAPI + MongoDB.

## Core Features

### 1. Authentication
- Email/password login/register
- Google Social Login (pending)
- JWT token authentication

### 2. Social Feed
- Filterable by dance disciplines
- Autoplay videos with carousel support
- Like, comment, save functionality
- Share to stories feature (in progress)
- Sponsored Ads integrated between posts (every 5 posts)

### 3. Stories (Instagram-like)
**Completed:**
- View stories with horizontal FlatList swiping between users
- Progress bar timer (6s photos, 60s videos)
- Hold to pause functionality
- Swipe UP for reactions modal
- Swipe DOWN to close
- 3D cube transition effect
- Bottom bar with message input + icons
- Viewer section with animated reactions
- Full Story Editor with sidebar tools

### 4. Reels
- Vertical scrolling video feed
- Like, comment, share functionality

### 5. Direct Messaging (Chat)
- 1-to-1 conversations
- Real-time messaging
- Message from stories

### 6. User Profiles
- Grid of posts
- Shop tab for video lessons
- Follow/unfollow
- "Sponsorizzate" menu item to manage ads

### 7. Lessons System
**Live 1-to-1:** Video calls via Daily.co with coaching review tools
**Group Lessons:** Teacher schedules classes, multiple students join via Daily.co
**Recorded Lessons:** Netflix-style tab with horizontal carousels by dance category

### 8. Bunny CDN Integration (Apr 2026) ✅ COMPLETE
**Video Delivery:**
- Bunny Stream for videos: Auto-transcoding to HLS for global delivery
- Stream Library ID: 635479
- Embed URL format: https://iframe.mediadelivery.net/embed/635479/{guid}

**Image Delivery:**
- Bunny Storage for images: Global CDN replication (EU, US, Asia)
- Storage Zone: beatmates-media
- CDN URL: https://beatmates-cd.b-cdn.net

**Benefits:**
- ✅ Fixes video latency in Asia (Hong Kong users)
- ✅ Fixes iOS 10-bit HDR video incompatibility
- ✅ Fixes photos appearing black for international users
- ✅ Auto-transcoding to HLS (adaptive bitrate)

## Technical Architecture

### Frontend (Expo/React Native)
```
/app/frontend/
├── app/(main)/
│   ├── home.tsx          # Feed with ads integration
│   ├── reels.tsx         # Reels viewer
│   ├── available.tsx     # Lessons tabs
│   ├── story/[id].tsx    # Story viewer (3D cube transitions)
│   ├── create-story.tsx  # Story creation
│   └── sponsor.tsx       # Ad management
├── src/components/
│   ├── InstagramStoryEditor.tsx
│   ├── PostCard.tsx
│   └── ...
└── src/services/api.ts   # API client with Bunny CDN support
```

### Backend (FastAPI)
```
/app/backend/
├── server.py             # Main server (3700+ lines)
│   ├── upload_video_to_bunny_stream()
│   ├── upload_image_to_bunny_storage()
│   └── GET /api/bunny/video/{guid}/status
└── uploads/              # Fallback media storage
```

## Known Issues
- P1: Reels autoplay slow/broken (needs pre-buffering)
- P1: Hold-to-pause missing on Home Feed (works on Stories)
- P2: ReviewsPopup carousel swipe broken
- P2: "i" Icon Size on Teacher card too small

## Next Tasks (Priority Order)
1. ✅ DONE: Bunny CDN integration for global video/image delivery
2. P0: Deploy Bunny CDN to OVH Production server
3. P1: Stripe Connect integration for real payments
4. P1: Fix Reels autoplay
5. P1: Fix Hold-to-pause on Home Feed

## 3rd Party Integrations
- **Bunny CDN**: Video streaming (Stream) + Image CDN (Storage) ✅ NEW
- **Daily.co**: Video calls
- **Expo Suite** (expo-av, expo-router)

## Bunny CDN Credentials (Production)
```
BUNNY_STREAM_LIBRARY_ID=635479
BUNNY_STREAM_API_KEY=a4259ebe-259a-412e-8b30e50de798-7aee-468d
BUNNY_STORAGE_ZONE=beatmates-media
BUNNY_STORAGE_API_KEY=a5975055-b9f4-4ee7-a7aa208d480a-5ae9-4ae0
BUNNY_CDN_URL=https://beatmates-cd.b-cdn.net
```

## Test Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- Production: fabriziocavada@gmail.com / abc123!
