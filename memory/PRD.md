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
- Reviews Popup (Google-style with arrows navigation)

## GROUP LESSONS (New - March 2026)

### Backend Endpoints
- `POST /api/group-lessons` - create (teacher)
- `GET /api/group-lessons` - list upcoming/live
- `GET /api/group-lessons/{id}` - details
- `POST /api/group-lessons/{id}/book` - book spot (student)
- `DELETE /api/group-lessons/{id}/book` - cancel booking
- `GET /api/my-group-lessons` - teacher's own lessons

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
  created_at: str
}
```

### Frontend
- Tabs "Live Ora" / "Lezioni" in Available page
- GroupLessonCard component (badge, date, spots, price, book/cancel)
- Create Group Lesson form (accessible from profile hamburger menu)
- Group video call layout (TODO): teacher large center, students grid

## Recent Fixes (March 2026)
- **CRITICAL FIX**: CallRatingModal was inline in `video-call/[id].tsx` (NOT the separate file). Added Keyboard API listener - modal moves to top when keyboard opens.
- ReviewsPopup: replaced ScrollView with arrow navigation (gesture issues in Modal)
- "i" button: larger (32px) with pink background circle

## Key Files
- `backend/server.py` - monolith (2500+ lines)
- `frontend/app/(main)/available.tsx` - tabs + teacher list + group lessons
- `frontend/app/(main)/create-group-lesson.tsx` - NEW form
- `frontend/app/(main)/video-call/[id].tsx` - video call + rating modal
- `frontend/src/components/GroupLessonCard.tsx` - NEW card component
- `frontend/src/components/ReviewsPopup.tsx` - arrow navigation
- `frontend/src/components/AvailableTeacherCard.tsx` - teacher card + "i" button

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
- Other: f.totti@roma.it / password123

## Known Issues
- ngrok tunnel can be unstable (infrastructure, not code)
- iPhone video autoplay regression in home feed
- Coaching sync may have issues (WebView state sync architectural limitation)

## Upcoming Tasks (Priority Order)
1. Group lesson video call layout (teacher large + student grid)
2. Stripe integration for real payments
3. Push notifications
4. Google Social Login
5. Deploy to OVH/AWS (Dockerfile preparation)
6. Native build for App Store / Play Store
7. Backend refactoring into modular routers
8. Sponsored posts system
