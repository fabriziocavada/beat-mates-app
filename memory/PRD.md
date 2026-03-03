# BEAT MATES - PRD (Product Requirements Document)

## Original Problem Statement
Social media mobile app for dancers called "BEAT MATES". Built with Expo (React Native) + FastAPI + MongoDB.

## Core Requirements
- **User System:** Register/login (email + planned Google auth)
- **Dance Disciplines:** Users select dance categories, feed filtered by them
- **Social Feed:** Instagram-like feed for photos, videos, text posts
- **Likes & Comments:** Like/comment with user thumbnail display
- **Stories:** Instagram-like stories with swipe navigation
- **Profile:** Editable profile with post grid, hamburger menu
- **Paid Lessons:** Live and pre-recorded dance lessons
- **Availability Calendar:** Teachers set availability
- **Music Page:** Upload music, playlists, player with speed controls
- **Video & Camera:** Vertical video recording (max 10s)
- **Dark theme** with coral accent (`#FF6978`)

## Tech Stack
- Frontend: React Native (Expo), TypeScript, Zustand, Expo Router
- Backend: FastAPI, Motor (async MongoDB), Python
- Database: MongoDB
- Video Calls: Daily.co
- Video Processing: ffmpeg

## What's Implemented (as of March 2026)
- User auth (JWT), registration, login
- Post/Story creation with photo/video
- Feed with likes, comments, carousels
- Reels page with video playback (WebView)
- Profile page with post grid, hamburger menu, edit profile
- Stories with sequential viewing and swipe
- Music upload, playlists, player page with smooth PanResponder sliders
- Video calls via Daily.co
- Teacher availability calendar with close button
- Lesson request notifications (blocking modal with sound)
- Save post feature
- Thumbnail generation (ffmpeg)
- Post detail page (full post view from profile grid click)

## Key API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login
- Users: GET /api/users/me, PUT /api/users/me
- Posts: GET /api/posts, GET /api/posts/{id}, POST /api/posts
- Likes: POST /api/posts/{id}/like
- Comments: GET/POST /api/posts/{id}/comments
- Save: POST /api/posts/{id}/save, GET /api/posts/saved
- Stories: GET /api/stories, POST /api/stories
- Music: GET/POST /api/music/songs, GET/POST /api/music/playlists
- Rooms: POST /api/rooms

## DB Schema
- users: {id, username, name, email, password_hash, profile_image, bio, dance_categories, is_available, hourly_rate, saved_posts}
- posts: {id, user_id, media_urls, media_type, thumbnail_url, likes, caption}
- stories: {id, user_id, media_url, media_type, thumbnail_url}
- live_sessions: {id, student_id, teacher_id, status, room_url}
- songs: {id, user_id, title, artist, genre, file_url, duration, playlist_id}
- playlists: {id, user_id, name}

## Backlog
### P0 (None remaining)

### P1
- Chat/Messaging between users
- Teacher-set lesson price UI
- Full Saved/Archive/Activity/Notifications page content

### P2
- Payment flow (Stripe/PayPal)
- Google social login
- Follow/Unfollow system
- Refactoring server.py into APIRouter modules
