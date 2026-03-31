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

### Completed in This Session:
- ✅ Integrated InstagramStoryEditor in create-story.tsx (replaced old StoryEditor)
- ✅ Added Hold-to-Pause on Home Feed videos (PostCard.tsx)
- ✅ Implemented ShareModal with Instagram-style grid and share options
- ✅ Connected ShareModal to PostCard and Reels
- ✅ Enhanced InstagramStoryEditor with more stickers (Cornice, Ritagli, Avatar, Prodotto, Donazione)
- ✅ Improved Text Editor toolbar with Instagram-style tools (rainbow color, italic, sparkles, alignment, animation)
- ✅ ShareModal now has Threads icon and horizontal scroll

### Previously Completed:
- Splash screen with custom loading video
- Story swipe gestures (UP/DOWN)
- Story 3D cube transition
- Story viewer section with reactions
- Recorded lessons Netflix tab
- Hold to pause on stories
- Basic story editor structure

### Known Issues:
- P2: ReviewsPopup carousel swipe broken (carried from previous sessions)
- P2: "i" Icon Size on Teacher card is too small

## Next Tasks (Priority Order)
1. P1: Test all new features thoroughly (Story Editor, Share Modal, Hold-to-Pause)
2. P1: Fix Reels autoplay if still broken
3. P2: ReviewsPopup carousel fix
4. P2: Stripe real integration
5. P2: Google Social Login

## 3rd Party Integrations
- Daily.co: Video calls
- Expo Suite (expo-av, expo-router)
- FFMPEG: Video compression (server-side)

## Test Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
