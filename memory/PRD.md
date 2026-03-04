# BEAT MATES - PRD (Product Requirements Document)

## Original Problem Statement
Social media mobile app called "BEAT MATES" for dancers, built with React Native (Expo) + FastAPI + MongoDB.

## Core Requirements
- **User System:** Registration/login with email/password. Google social login (future).
- **Dance Disciplines:** Filter feed by dance categories.
- **Social Feed:** Instagram-like feed with photos, videos, text posts. Carousel (multi-image) support.
- **Likes & Comments:** Standard like/comment. Double-tap to like with heart animation.
- **Stories:** Instagram-like stories (vertical, 24h expiry) with video support via expo-video.
- **Profile:** User profile with grid posts, stories, shop tab, hamburger menu (Saved, Archive, Activity).
- **E-commerce:** Shop tab for selling video dance lessons. Set price, edit details, reviews.
- **Live Lessons:** Book/pay for live video lessons with teachers (Daily.co).
- **Music Page:** Upload music, playlists, player with speed controls.
- **Chat:** Direct messaging between users.
- **Notifications:** Lesson request notifications.
- **Design:** Dark theme, coral accent (#FF6978).

## Tech Stack
- **Frontend:** React Native (Expo), TypeScript, Zustand, Expo Router
- **Backend:** Python, FastAPI, Motor (async MongoDB)
- **Database:** MongoDB
- **Key Libs:** expo-video (native video), @react-native-community/slider, expo-image-picker (multi-select), ffmpeg

## Test Accounts
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123

---

## What's Been Implemented

### Authentication & Users
- [x] JWT auth (login/register)
- [x] Profile management (edit bio, picture, categories)
- [x] Follow/Unfollow
- [x] User search with **fuzzy matching** (handles typos)

### Social Feed
- [x] Create posts (photo, video, text)
- [x] Carousel posts (multi-image with swipe, up to 10 images, dots indicator)
- [x] **Custom thumbnail selection for video posts**
- [x] Like/Unlike posts (optimistic UI)
- [x] Double-tap to like with heart animation
- [x] Comments
- [x] Save/Bookmark posts
- [x] Delete own posts
- [x] Stories (create, view, 24h expiry)
- [x] Story thumbnails for video stories
- [x] Reels (vertical scroll) with **performance optimization** (only active video rendered)
- [x] **Reels shows videos from carousel posts**
- [x] **Audio stops when scrolling from video to image in carousel**

### Profile
- [x] Own profile with posts grid and shop tab
- [x] **Click profile picture opens stories** (if present)
- [x] **Shop tab works on OTHER users' profiles** (video lessons visible)

### Navigation
- [x] Search button in header -> search page
- [x] Messages button in header -> chat list
- [x] Music tab working from ALL pages
- [x] TabBar navigation complete

### E-commerce
- [x] Upload video lessons with compression
- [x] Set price (EUR), edit details
- [x] Video lesson player
- [x] Reviews system (CRUD)
- [x] Thumbnail generation (ffmpeg)

### Music
- [x] Music page with player
- [x] Speed controls
- [x] Native slider (iOS compatible)

### Live Lessons (Daily.co)
- [x] Request live lesson
- [x] Accept/reject lesson requests
- [x] Video call via Daily.co iframe
- [x] Fixed infinite ringing bug

### Messaging & Social
- [x] Chat system (conversations list, individual chats)
- [x] DM from header and user profiles

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Stripe payment integration (buy video lessons)

### P1 (Important)
- [ ] Post-video-call review system (1-5 stars)
- [ ] Complete Saved/Archive/Activity pages with real data
- [ ] Refactor backend/server.py into APIRouter modules

### P2 (Future)
- [ ] Paid audio playlists (monthly subscription)
- [ ] Shareable playlists
- [ ] Production deployment strategy (App Store, Play Store, AWS)
- [ ] Google social login
- [ ] Push notifications
- [ ] Report/Block users
- [ ] Share posts externally
- [ ] Explore/Discover page

---

## Latest Changes (December 2025)

### Bug Fixes Completed
1. **P0: Video carousel in Reels** - Videos from carousel posts now appear correctly (not black screen)
2. **P0: Shop tab on other users' profiles** - Now shows video lessons when visiting another user's profile
3. **P0: Audio leak in carousel** - Video audio stops when scrolling to images in carousel
4. **P1: Profile picture click** - Opens stories if user has active stories
5. **P1: Reels performance** - Only the currently visible video is rendered (WebView optimization)

### New Features Completed
1. **Fuzzy search** - User search now handles typos (e.g., "tutro" finds "tutor")
2. **Custom video thumbnail** - When creating a video post, users can select a custom thumbnail from gallery
3. **Single image deletion from carousel** - Already implemented (removeMedia function)

### Test Results
- Backend: 17/17 tests passed (100%)
- All features verified at API level
- Frontend is React Native Expo - test on mobile device via Expo Go
