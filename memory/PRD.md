# BEAT MATES - PRD

## Original Problem Statement
Social media mobile app for dancers "BEAT MATES". Expo (React Native) + FastAPI + MongoDB.

## What's Implemented (as of March 2026)

### Core Social
- User auth (JWT), registration, login
- Post/Story creation with photo/video
- Feed with likes, comments, carousels, save post
- Reels page with video playback (WebView)
- Stories in **rectangular vertical format** (68x88, borderRadius:10)

### Profile
- Profile page with post grid, hamburger menu (Messaggi, Attivita, Salvati, Archivio, Notifiche, Calendario, Edit Profile, Logout)
- Edit profile (name, username, bio, photo)
- **E-commerce tab** (cart icon) with video lesson cards

### Video Lessons E-commerce
- Upload video lessons with **ffmpeg compression** (libx264, crf:28, 720p max)
- Auto thumbnail generation + duration detection
- Edit/Delete lessons (owner only)
- Price display in EUR
- **Reviews system** (1-5 stars + text, no self-review, no duplicates)
- Loading indicator during upload

### Music
- Upload songs, create/manage playlists
- Player page with **cover image**, **touch-based sliders** (onResponder* API), TabBar
- Progress bar seek + speed control (-5 to +5 = 0.5x to 1.5x)
- Waveform visualization

### Chat/Messaging
- Create conversations, send/receive messages
- Messages list with **3-second polling**
- "Messaggio" button on user profiles creates/opens conversation

### Other
- Video calls via Daily.co
- Teacher availability calendar with close button
- Lesson request notifications (blocking modal with sound)
- Thumbnail generation (ffmpeg)
- Post detail page (from profile grid click)
- **Saved posts** page with grid layout
- **Activity** page (likes/comments on your posts)
- **Notifications** page (lesson requests)
- Media serving with proper content-types (mp3/audio/mpeg for iOS)

## Key API Endpoints
- Auth: POST /api/auth/register, /api/auth/login
- Users: GET/PUT /api/users/me
- Posts: GET /api/posts, GET /api/posts/{id}, POST /api/posts
- Likes/Comments/Save: POST /api/posts/{id}/like|comments|save
- Stories: GET/POST /api/stories
- Music: GET/POST /api/music/songs|playlists
- Video Lessons: POST/GET /api/video-lessons, PUT/DELETE /api/video-lessons/{id}
- Reviews: POST/GET /api/video-lessons/{id}/reviews
- Chat: GET/POST /api/conversations, GET/POST /api/conversations/{id}/messages
- Rooms: POST /api/rooms

## Backlog
### P1
- Buy button + payment flow for video lessons (buyer side)
- Video lesson playback page for buyers
- Follow/Unfollow system

### P2
- Payment integration (Stripe/PayPal)
- Google social login
- Refactoring server.py into APIRouter modules
