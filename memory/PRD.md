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

### Backend Endpoints (All tested, 42/42 passed across iterations 21+22)
- `POST /api/group-lessons` - create (teacher)
- `GET /api/group-lessons` - list upcoming/live
- `GET /api/group-lessons/{id}` - details
- `POST /api/group-lessons/{id}/book` - book + mock payment + booking notification
- `DELETE /api/group-lessons/{id}/book` - cancel booking
- `GET /api/my-group-lessons` - teacher's own lessons
- `POST /api/group-lessons/{id}/start` - start lesson (creates Daily.co room + notifies all booked students)
- `POST /api/group-lessons/{id}/join` - student joins live lesson
- `POST /api/group-lessons/{id}/end` - teacher ends lesson

### Notification System (NEW - March 2026)
- `GET /api/notifications` - user's notifications (sorted desc)
- `GET /api/notifications/unread-count` - count of unread
- `POST /api/notifications/{id}/read` - mark as read
- Types: `booking_confirmed`, `group_lesson_started`
- Tapping "lesson started" notification navigates to group-video-call

### Mock Payment System (NEW - March 2026)
- `group_lesson_payments` collection tracks all bookings
- PaymentModal component shows card mockup, price, lesson details
- Success screen confirms booking with notification promise
- Will be replaced with Stripe integration

### DB Schemas
```
group_lessons: { id, teacher_id, title, description, dance_category, scheduled_at, duration_minutes, max_participants, price, booked_count, booked_users, status, room_url, room_name, created_at }
group_lesson_payments: { id, user_id, lesson_id, amount, currency, status, payment_method, created_at }
notifications: { id, user_id, type, title, message, data, read, created_at }
```

### Frontend
- Tabs "Live Ora" / "Lezioni" in Available page
- GroupLessonCard component (badge, date, spots, price, book/cancel/start/join)
- Create Group Lesson form (accessible from profile hamburger menu)
- **PaymentModal** - Mock payment sheet before booking (card mockup, price, success animation)
- **Group Video Call screen** (`group-video-call/[id].tsx`) with Daily.co WebView
- **Notifications screen** - Real notifications with types, unread indicators, tap-to-navigate

## Key Files
- `backend/server.py` - monolith (2700+ lines)
- `frontend/app/(main)/available.tsx` - tabs + teacher list + group lessons + payment modal
- `frontend/app/(main)/create-group-lesson.tsx` - create form
- `frontend/app/(main)/group-video-call/[id].tsx` - group video call screen
- `frontend/app/(main)/video-call/[id].tsx` - 1-to-1 video call + coaching + rating
- `frontend/app/(main)/notifications.tsx` - real notifications with types
- `frontend/src/components/GroupLessonCard.tsx` - card component
- `frontend/src/components/PaymentModal.tsx` - mock payment component
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
1. Stripe integration for real payments (replace mock)
2. Push notifications (native, not just in-app)
3. Google Social Login
4. Deploy to OVH/AWS (Dockerfile preparation)
5. Native build for App Store / Play Store
6. Backend refactoring into modular routers
7. Sponsored posts system
