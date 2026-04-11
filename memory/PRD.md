# BEAT MATES - Product Requirements Document

## Overview
Social media mobile app for dancers built with Expo (React Native) + FastAPI + MongoDB.

## Core Features

### 1. Authentication
- Email/password login/register
- JWT token authentication

### 2. Social Feed
- Filterable by dance disciplines
- Autoplay videos with carousel support
- Like, comment, save functionality
- Sponsored Ads integrated between posts (every 5 posts)

### 3. Stories (Instagram-like)
- Horizontal swiping with 3D cube transition
- Progress bar timer (6s photos, 60s videos)
- Hold to pause, swipe UP for reactions, swipe DOWN to close
- Full Story Editor with drawing, text, stickers

### 4. Reels
- Vertical scrolling video feed
- Pre-buffering for smoother scrolling (NEW)
- Like, comment, share functionality

### 5. Direct Messaging (Chat)
- 1-to-1 conversations
- Real-time messaging

### 6. User Profiles
- Grid of posts
- Shop tab for video lessons
- Follow/unfollow

### 7. Lessons System
- Live 1-to-1 via Daily.co
- Group Lessons
- Recorded Lessons (Netflix-style UI)

## Performance Optimizations (NEW - Apr 2026)

### Bunny CDN Integration
- **Bunny Stream** for videos: Auto-transcoding to HLS
- **Bunny Storage** for images: Global CDN (EU, US, Asia)
- Stream Library ID: 635479
- CDN URL: https://beatmates-cd.b-cdn.net

### Image Optimization
- `OptimizedImage` component with expo-image caching
- Shimmer loading placeholders
- Pre-loading of first 10 images in feed
- Memory + disk cache

### Video Optimization - NATIVE PLAYER (NEW)
- **Replaced WebView with expo-av native Video player** - MUCH faster!
- Pre-loading of 2 adjacent reels
- Client-side video compression before upload
- Client-side image compression (max 1200px, 70% quality)

### Upload Compression
- Videos: react-native-compressor (native builds)
- Images: expo-image-manipulator (1200px, 70% quality)

## Technical Architecture

### Frontend
```
/app/frontend/
├── src/components/
│   ├── OptimizedMedia.tsx    # NEW: Cached images with shimmer
│   ├── PostCard.tsx          # Uses OptimizedImage
│   └── ...
├── src/services/
│   ├── api.ts                # Bunny CDN URL helpers
│   └── videoCompressor.ts    # Image + video compression
└── app/(main)/
    ├── home.tsx              # Pre-loads first 10 images
    ├── reels.tsx             # Pre-buffers adjacent videos
    └── ...
```

### Backend
```
/app/backend/
├── server.py                 # Bunny CDN upload functions
└── .env                      # Bunny credentials
```

## Bunny CDN Credentials
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

## Deployment
- **Backend**: OVH VPS (api.beatmates.app) via Docker
- **App**: TestFlight (iOS), requires EAS build for updates
- **Database**: MongoDB Atlas

## Next Tasks
1. Deploy updated frontend to TestFlight (user must run `eas build`)
2. Stripe Connect for real payments
3. Push Notifications

## Known Issues (Pending)
- ReviewsPopup carousel swipe broken
- Hold-to-pause missing on Home Feed videos
