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
- Stories (Instagram-like) + swipe-up reactions
- Likes, comments, saves + double-tap like (images, carousels, videos)
- User profiles with post grid
- Follow/unfollow system
- Reels (vertical video feed)
- Music page (playlists, songs, speed controls)
- E-commerce: video lessons shop + info popup
- Live video lessons via Daily.co (1-to-1 + group)
- Post-call rating system
- Direct messaging
- User search with fuzzy matching
- Custom thumbnail selection
- Premium playlists (mock payments)
- Video compression (ffmpeg, H.264 8-bit)
- Coaching Review Tool (draw, undo last stroke, speed, sync)
- Available Teachers list with availability status
- Reviews Popup (arrow navigation)

## Notification System (March 2026)
Types: `like`, `chat_message`, `lesson_booked`, `story_reaction`, `booking_confirmed`, `group_lesson_started`
- `GET /api/notifications` - all user notifications
- `GET /api/notifications/unread-count`
- `POST /api/notifications/{id}/read`
- Auto-created when: someone likes your post, sends a message, books a lesson, reacts to story, teacher starts group lesson

## Group Lessons (March 2026)
Full Zoom-like experience:
- Teacher as room owner (unmuted), students muted by default
- Hand raise system: raise/lower/allow/revoke
- "SOLO IO" button: teacher mutes all, resets hands
- Mock payment before booking (works during live too)
- Dedicated token endpoint with role-based permissions

### Endpoints
- CRUD: create, list, get, book, cancel, my-lessons
- Video: start, join, end, token, raise-hand, lower-hand, hands, allow-speak, revoke-speak, mute-all

## Availability Slots
- Teachers set availability with lesson_type: "single", "group", or "both"
- Students book slots → teacher gets notification

## Story Reactions
- Swipe up → emoji picker (6 reactions)
- Animated reaction display
- Backend stores reactions + notifies story owner

## E-commerce Info Popup
- "i" button on lesson cards in profile shop
- Shows title, duration, price, description

## Key Files
- `backend/server.py` - monolith (2900+ lines)
- `frontend/app/(main)/available.tsx`
- `frontend/app/(main)/group-video-call/[id].tsx`
- `frontend/app/(main)/story/[id].tsx` - with swipe reactions
- `frontend/app/(main)/profile.tsx` - with lesson info popup
- `frontend/app/(main)/calendar.tsx` - with lesson type selector
- `frontend/app/(main)/notifications.tsx`
- `frontend/src/components/PostCard.tsx` - double-tap all media
- `frontend/src/components/CoachingReview.tsx` - undo fix
- `frontend/src/components/PaymentModal.tsx`
- `frontend/src/components/GroupLessonCard.tsx`

## Credentials
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123

## Known Issues
- ReviewsPopup carousel swipe broken (using arrows)
- Video playback can be slow (compression/serving)
- ngrok tunnel instability (infrastructure)

## Upcoming Tasks
1. Stripe integration (replace mock payments)
2. Push notifications (native)
3. Google Social Login
4. Deploy to OVH/AWS (Dockerfiles)
5. App Store / Play Store builds
6. Backend refactoring into modular routers
7. Sponsored posts system
