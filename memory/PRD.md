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
- Full Story Editor with drawing, text, stickers (BROKEN - needs fix)

### 4. Reels
- Vertical scrolling video feed (TikTok-style)
- Native expo-av Video player (no WebView)
- Bunny Stream HLS direct playback (converted from embed URLs)
- Thumbnail poster from CDN for instant preview
- Pre-buffering of 2 adjacent reels
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

### 8. Search / Explore
- Instagram-style explore grid (large + small tiles)
- Category chips filter (dance disciplines)
- User search with debounce
- Suggested users when search bar is focused
- Tapping videos opens Reels view

## Performance Architecture

### Bunny CDN Integration
- **Bunny Stream** for videos: Auto-transcoding to HLS
- **Bunny Storage** for images: Global CDN (EU, US, Asia)
- Stream Library ID: 635479
- CDN URL: https://beatmates-cd.b-cdn.net
- Direct HLS: https://vz-635479.b-cdn.net/{guid}/playlist.m3u8
- Thumbnails: https://vz-635479.b-cdn.net/{guid}/thumbnail.jpg

### Video URL Resolution (CRITICAL FIX - Feb 2026)
- Backend stores Bunny Stream embed URLs: `iframe.mediadelivery.net/embed/635479/{guid}`
- **expo-av CANNOT play embed URLs** - they are HTML pages, not video streams
- `getDirectVideoUrl()` in api.ts converts embed → HLS: `vz-635479.b-cdn.net/{guid}/playlist.m3u8`
- `getBunnyThumbnailUrl()` gets poster: `vz-635479.b-cdn.net/{guid}/thumbnail.jpg`
- Local paths fallback to `getMediaUrl()` as before

### Image Optimization
- `OptimizedImage` component with expo-image caching
- Shimmer loading placeholders
- Memory + disk cache

### Upload Compression
- Videos: react-native-compressor (native builds only)
- Images: expo-image-manipulator (1200px, 70% quality)

## Technical Architecture

### Frontend
```
/app/frontend/
├── src/components/
│   ├── OptimizedMedia.tsx     # Cached images with shimmer
│   ├── PostCard.tsx           # Uses getDirectVideoUrl for videos
│   └── ...
├── src/services/
│   ├── api.ts                 # getDirectVideoUrl, getBunnyThumbnailUrl helpers
│   └── videoCompressor.ts     # Image + video compression
└── app/(main)/
    ├── home.tsx
    ├── reels.tsx              # TikTok-style with poster + HLS + pre-load
    ├── search.tsx             # Instagram Explore grid + categories + suggestions
    └── ...
```

### Backend
```
/app/backend/
├── server.py                  # Monolithic FastAPI (3700+ lines)
└── .env                       # Bunny credentials
```

## Deployment
- **Backend**: OVH VPS (api.beatmates.app) via Docker
- **App**: TestFlight (iOS), requires EAS build for updates
- **Database**: MongoDB Atlas

## Pending Issues
1. Story Editor broken (text/sticker/drawing)
2. Share Modal (airplane icon) not working
3. Hold-to-pause missing on Home Feed videos
4. Mentions list empty in Story Editor
5. ReviewsPopup.tsx Carousel Swipe broken

## Next Tasks (Priority)
1. User deploys Build 11 to TestFlight (git pull + eas build)
2. Stripe Connect for real payments (80/20 split)
3. Admin Dashboard Web App
4. Push Notifications
5. Google Social Login
6. Refactor server.py into modular routers
