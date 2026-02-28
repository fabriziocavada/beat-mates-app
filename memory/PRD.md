# BEAT MATES - Product Requirements Document

## Problem Statement
Social media mobile app for dancers called "BEAT MATES". Built with Expo (React Native) frontend and FastAPI/MongoDB backend.

## Tech Stack
- Frontend: React Native (Expo), TypeScript, Zustand, Expo Router, react-native-webview
- Backend: Python, FastAPI, httpx
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via WebView)
- Media: Images/Videos served as direct files via /api/media/ endpoint

## What's Implemented
- User registration & login (email/password)
- Dance category selection
- Social feed with posts (photo, video, text)
- Post creation with image/video upload
- Like & comment system
- Instagram-like stories (24h expiry)
- User profiles with post count, followers
- Follow/unfollow system
- Teacher availability toggle
- Availability calendar with interactive time picker
- Live session request/accept/reject flow
- VIDEO CALL via Daily.co (WebView-based, works in Expo Go)
- Lesson request notification banner (visual + sound + vibration)
- File upload with ffmpeg video conversion
- 6-icon tab bar navigation

## Changes - Feb 28, 2026 (Session 2)
- Removed base64 video embedding - videos now served as direct files
- ReelVideoPlayer: zero hooks, simple Video component render
- Profile '+' stories button: now navigates to create-story
- Daily.co video call integration (create room on accept, WebView)
- Calendar time picker: interactive arrows

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## 3rd Party Integrations
- Daily.co (API key in backend/.env)

## Pending Tasks
### P1
- Teacher-set lesson prices UI
- Post/Story video recording from camera

### P2
- Availability calendar improvements

### P3/Backlog
- Payment flow (Stripe/PayPal)
- Google social login
- Dedicated "Music" page
- Like/Follow improvements
- Code refactoring (split server.py)
