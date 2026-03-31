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

**In Progress:**
- Full Story Editor (Instagram-identical):
  - Sidebar with: Testo, Adesivi, Audio, Menziona, Sfondo, Disegna, Scarica
  - Text editor with fonts (Modern/Classic/Signature)
  - Stickers panel with widgets
  - Draggable elements
  - Drawing tool

### 4. Reels
- Vertical scrolling video feed
- Like, comment, share functionality
- Hold to pause (pending for home feed)

### 5. Direct Messaging (Chat)
- 1-to-1 conversations
- Real-time messaging
- Message from stories

### 6. User Profiles
- Grid of posts
- Shop tab for video lessons
- Follow/unfollow

### 7. Lessons System
**Live 1-to-1:**
- Video calls via Daily.co
- Coaching review tools

**Group Lessons:**
- Teacher schedules classes
- Multiple students join via Daily.co
- Payment integration

**Recorded Lessons (NEW):**
- Netflix-style tab with horizontal carousels
- Categories: Latino Americani, Ballroom, Caraibiche
- Each subcategory has lessons carousel
- 32 demo lessons created

### 8. Music Section
- Playlists
- Speed controls

### 9. Payments
- Stripe integration (pending real keys)
- Currently using mock payments

### 10. Notifications
- Push notifications (pending native integration)

## Technical Architecture

### Frontend (Expo/React Native)
```
/app/frontend/
├── app/(main)/           # Main app screens
│   ├── home.tsx          # Feed
│   ├── reels.tsx         # Reels viewer
│   ├── available.tsx     # Lessons (Live/Group/Recorded tabs)
│   ├── story/[id].tsx    # Story viewer (rewritten with FlatList)
│   ├── create-story.tsx  # Story creation + editor
│   └── ...
├── src/components/
│   ├── StoryEditor.tsx   # Instagram-style editor (in progress)
│   ├── PostCard.tsx      # Feed post card
│   ├── RecordedLessonCard.tsx  # Netflix lesson card
│   └── ...
└── src/services/api.ts   # API client
```

### Backend (FastAPI)
```
/app/backend/
├── server.py             # Main server (3100+ lines - needs refactoring)
└── uploads/              # Media storage
```

### Database (MongoDB)
Collections: users, posts, stories, story_reactions, conversations, messages, video_lessons, etc.

## API Endpoints
- POST /api/stories - Create story (with 60s chunking for long videos)
- GET /api/stories/{id}/reactions - Get reactions/viewers
- POST /api/stories/{id}/react - Send reaction
- GET /api/video-lessons/by-category - Netflix-style grouped lessons
- POST /api/conversations - Create/find conversation
- And many more...

## Current Session Progress (Dec 2025)

### Completed:
- Splash screen with custom loading video
- Story swipe gestures (UP/DOWN)
- Story 3D cube transition
- Story viewer section with reactions
- Recorded lessons Netflix tab
- Hold to pause on stories
- Basic story editor

### In Progress:
- Full Instagram-identical Story Editor
- Share panel for reels/posts
- Hold to pause on home feed

### Known Issues:
- Story editor drag not working
- Drawing tool not implemented
- Background picker not working
- Share button on reels not opening panel

## Next Tasks (Priority Order)
1. P0: Complete Story Editor (Instagram-identical)
2. P0: Share Modal for reels/posts
3. P1: Fix draggable elements
4. P1: Implement drawing tool
5. P1: Hold to pause on home feed
6. P2: Stripe real integration
7. P2: ReviewsPopup carousel fix (carried from previous sessions)

## 3rd Party Integrations
- Daily.co: Video calls
- Expo Suite (expo-av, expo-router)
- FFMPEG: Video compression (server-side)

## Test Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
