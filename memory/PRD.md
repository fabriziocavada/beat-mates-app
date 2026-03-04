# BEAT MATES - PRD (Product Requirements Document)

## Original Problem Statement
Social media mobile app called "BEAT MATES" for dancers, built with React Native (Expo) + FastAPI + MongoDB.

## Core Requirements
- **User System:** Registration/login with email/password. Google social login (future).
- **Dance Disciplines:** Filter feed by dance categories.
- **Social Feed:** Instagram-like feed with photos, videos (autoplay), text posts. Carousel (multi-image) support.
- **Likes & Comments:** Standard like/comment. Double-tap to like.
- **Stories:** Instagram-like stories (vertical, 24h expiry).
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
- **Key Libs:** react-native-webview, @react-native-community/slider, expo-av, expo-image-picker, ffmpeg

## User Personas
- **Dancer/Student:** Browses feed, watches lessons, buys content, chats
- **Teacher/Creator:** Posts content, sells video lessons, goes live, manages availability

## Test Accounts
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123

---

## What's Been Implemented

### Authentication & Users
- [x] JWT auth (login/register)
- [x] Profile management (edit bio, picture, categories)
- [x] Follow/Unfollow
- [x] User search (by username/name)

### Social Feed
- [x] Create posts (photo, video, text)
- [x] Carousel posts (multi-image with swipe, up to 10 images)
- [x] Like/Unlike posts
- [x] Double-tap to like (heart animation)
- [x] Comments
- [x] Save/Bookmark posts
- [x] Delete own posts (long-press on profile grid, trash icon in detail)
- [x] Stories (create, view, 24h expiry)
- [x] Reels (vertical scroll)

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

### Messaging & Social
- [x] Chat system (conversations list, individual chats)
- [x] DM from header (messages button wired)
- [x] Search page (search users from header)

### Camera
- [x] Full-screen camera (removed square constraint)
- [x] Photo and video capture
- [x] Gallery picker with multi-select

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Stripe payment integration (buy video lessons)

### P1 (Important)
- [ ] Complete Saved/Archive/Activity pages with real data
- [ ] Refactor backend/server.py into APIRouter modules

### P2 (Future)
- [ ] Production deployment strategy (App Store, Play Store, AWS)
- [ ] Google social login
- [ ] Push notifications
- [ ] Report/Block users
- [ ] Share posts externally
- [ ] Explore/Discover page
