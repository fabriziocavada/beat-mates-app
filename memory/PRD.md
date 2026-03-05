# BEAT MATES - PRD (Product Requirements Document)

## Original Problem Statement
Social media mobile app called "BEAT MATES" for dancers, built with React Native (Expo) + FastAPI + MongoDB.

## Core Requirements
- **User System:** Registration/login with email/password. Google social login (future).
- **Dance Disciplines:** Filter feed by dance categories.
- **Social Feed:** Instagram-like feed with photos, videos, text posts. Carousel (multi-image) support.
- **Likes & Comments:** Standard like/comment. Double-tap to like with heart animation.
- **Stories:** Instagram-like stories (vertical, 24h expiry) with video support via expo-video.
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
- **Key Libs:** expo-video, @react-native-community/slider, expo-image-picker, react-native-webview

## Test Accounts
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123

---

## What's Been Implemented

### Authentication & Users
- [x] JWT auth (login/register)
- [x] Profile management (edit bio, picture, categories)
- [x] Follow/Unfollow
- [x] User search with **fuzzy matching** (handles typos)

### Social Feed
- [x] Create posts (photo, video, text)
- [x] Carousel posts (multi-image with swipe)
- [x] **Custom thumbnail selection for video posts**
- [x] Like/Unlike posts (optimistic UI)
- [x] Double-tap to like with heart animation
- [x] Comments
- [x] Save/Bookmark posts
- [x] Delete own posts
- [x] Stories (create, view, 24h expiry)
- [x] Story thumbnails for video stories
- [x] Reels (vertical scroll) with **performance optimization** (only active video rendered)
- [x] **Reels shows videos from carousel posts**
- [x] **Audio stops when scrolling from video to image in carousel**

### Profile
- [x] Own profile with posts grid and shop tab
- [x] **Click profile picture opens stories** (if present)
- [x] **Shop tab works on OTHER users' profiles** (video lessons visible)

### E-commerce
- [x] Upload video lessons with compression
- [x] Set price (EUR), edit details
- [x] Video lesson player
- [x] **MOCKUP: Payment screen for purchasing lessons** (Stripe not integrated)
- [x] Reviews system (CRUD)
- [x] Thumbnail generation (ffmpeg)

### Music
- [x] Music page with player
- [x] Speed controls
- [x] Native slider (iOS compatible)
- [x] **Playlist Premium with subscription ($10/month)** - MOCKUP
- [x] **Demo songs preview (3-4 tracks)**

### Live Lessons (Daily.co)
- [x] Request live lesson
- [x] Accept/reject lesson requests
- [x] Video call via Daily.co iframe
- [x] **Post-call review system (1-5 stars, WhatsApp style)**
- [x] Average rating displayed on teacher profile

### Messaging & Social
- [x] Chat system (conversations list, individual chats)
- [x] DM from header and user profiles

---

## Latest Changes (December 2025)

### Session 2 - New Features
1. **Recensioni Post-Videochiamata (stile WhatsApp)**
   - Modal grande con 5 stelle dopo chiusura chiamata
   - Commento opzionale
   - Calcolo automatico media voti sul profilo insegnante

2. **Mockup Pagamento E-commerce**
   - Quando visiti profilo altro utente e clicchi su una lezione
   - Schermata "Acquista" con preview, prezzo, mockup carta
   - Simula pagamento (2 sec) → sblocca video

3. **Playlist Premium a Pagamento**
   - Nuova pagina "Playlist Premium"
   - 3 playlist demo (Latin, Hip Hop, Tango)
   - 3-4 tracce demo visibili
   - Abbonamento mensile $10 (MOCKUP)
   - Bottone dorato nella pagina Music

4. **Selezione Thumbnail Personalizzata** (implementata sessione precedente)
   - Bottone per scegliere thumbnail dalla galleria
   - Preview thumbnail selezionata

### Bug Fix (Sessione 1)
- Video carousel nei Reels
- Tab Shop profili altri utenti
- Audio leak nel carousel
- Click foto profilo → storie
- Performance Reels

### Test Results
- Backend: 19/19 tests passed (100%)
- Tutte le feature verificate a livello API

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Stripe payment integration (REAL payments)

### P1 (Important)
- [ ] Complete Saved/Archive/Activity pages with real data
- [ ] Refactor backend/server.py into APIRouter modules
- [ ] Push notifications for lesson requests

### P2 (Future)
- [ ] Production deployment strategy (App Store, Play Store, AWS)
- [ ] Google social login
- [ ] Report/Block users
- [ ] Share posts externally
- [ ] Explore/Discover page

---

## MOCKED APIs (Stripe integration pending)
- `POST /api/purchases/mock` - Simula acquisto lezione
- `POST /api/music/playlists/{id}/subscribe` - Simula abbonamento playlist
- Nessun pagamento reale viene processato
