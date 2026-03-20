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
- Stories (Instagram-like)
- Likes, comments, saves
- User profiles with post grid
- Follow/unfollow system
- Reels (vertical video feed)
- Music page (playlists, songs, speed controls)
- E-commerce: video lessons shop on profiles
- Live video lessons via Daily.co (1-to-1)
- Post-call rating system
- Direct messaging (basic)
- User search with fuzzy matching
- Custom thumbnail selection for video posts
- Premium playlists (mock payments)
- Automatic video compression (ffmpeg, H.264 8-bit)
- Server-side video player endpoint
- Live Coaching Tool (record, slow-motion, drawing, sync)
- Available Teachers list with availability status
- Reviews Popup (arrow navigation)

## GROUP LESSONS (Completed - March 2026)

### Backend Endpoints (All tested, 29/29 passed)
- `POST /api/group-lessons` - create (teacher)
- `GET /api/group-lessons` - list upcoming/live
- `GET /api/group-lessons/{id}` - details
- `POST /api/group-lessons/{id}/book` - book spot (student)
- `DELETE /api/group-lessons/{id}/book` - cancel booking
- `GET /api/my-group-lessons` - teacher's own lessons
- `POST /api/group-lessons/{id}/start` - start lesson (creates Daily.co room)
- `POST /api/group-lessons/{id}/join` - student joins live lesson
- `POST /api/group-lessons/{id}/end` - teacher ends lesson

### DB Schema: group_lessons collection
```
{
  id: uuid,
  teacher_id: str,
  title: str,
  description: str,
  dance_category: str,
  scheduled_at: str (ISO),
  duration_minutes: int,
  max_participants: int,
  price: float,
  booked_count: int,
  booked_users: [str],
  status: "upcoming"|"live"|"completed"|"cancelled",
  room_url: str|null,
  room_name: str|null,
  created_at: str
}
```

### Frontend
- Tabs "Live Ora" / "Lezioni" in Available page
- GroupLessonCard component (badge, date, spots, price, book/cancel/start/join)
- Create Group Lesson form (accessible from profile hamburger menu)
- **Group Video Call screen** (`group-video-call/[id].tsx`):
  - WebView with Daily.co (default grid layout for multiple participants)
  - Teacher controls: "Termina" button (ends lesson for all, deletes Daily.co room)
  - Student controls: "Esci" button (leaves the call)
  - Live indicator badge with lesson title and participant count
  - Android support via external browser
  - Auto-retry on connection errors

## Key Files
- `backend/server.py` - monolith (2600+ lines)
- `frontend/app/(main)/available.tsx` - tabs + teacher list + group lessons
- `frontend/app/(main)/create-group-lesson.tsx` - create form
- `frontend/app/(main)/group-video-call/[id].tsx` - group video call screen
- `frontend/app/(main)/video-call/[id].tsx` - 1-to-1 video call + coaching + rating
- `frontend/src/components/GroupLessonCard.tsx` - card component
- `frontend/src/components/ReviewsPopup.tsx` - arrow navigation
- `frontend/src/components/AvailableTeacherCard.tsx` - teacher card + "i" button

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- Other: f.totti@roma.it / password123

## Known Issues
- ReviewsPopup carousel swipe broken (using arrow navigation as workaround)
- "i" icon for reviews may be too small for some users
- 1-to-1 coaching sync may have issues
- ngrok tunnel can be unstable (infrastructure, not code)

## Upcoming Tasks (Priority Order)
1. Stripe integration for real payments
2. Push notifications
3. Google Social Login
4. Deploy to OVH/AWS (Dockerfile preparation)
5. Native build for App Store / Play Store
6. Backend refactoring into modular routers
7. Sponsored posts system
8. ReviewsPopup swipe fix (if user requests)
