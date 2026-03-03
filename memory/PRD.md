# BEAT MATES - Product Requirements Document

## Tech Stack
- Frontend: React Native (Expo SDK 54), TypeScript, Zustand, Expo Router, react-native-webview, expo-av (audio), expo-document-picker
- Backend: Python 3, FastAPI, Uvicorn, motor (async MongoDB)
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via daily-js SDK in WebView, auto-join)
- Thumbnails: ffmpeg/ffprobe (first frame extraction + audio duration)
- Media: Direct file serving via /api/uploads/

## What's Implemented
- User registration & login (JWT), dance categories, social feed, stories, profiles
- Video playback via WebView with HTML5 <video> tag (DO NOT CHANGE)
- Daily.co video call: auto-join senza popup (JS SDK)
- Story viewer Instagram-like: progress bar, auto-advance, swipe tra utenti
- Video thumbnails generati con ffmpeg nel profilo
- Notifiche lezione: Modal a schermo intero bloccante
- Hamburger menu profilo Instagram-style (slide-up sheet)
- Like con thumbnail profilo recenti (stile Instagram)
- **MUSIC PAGE**: Libreria musicale completa con:
  - Filtri genere (ALL, SAMBA, TANGO, LATIN, HIP HOP, JAZZ, CONTEMPORARY, AFRO, REGGAETON)
  - Upload canzoni dal dispositivo
  - Creazione/gestione playlist
  - Like/Unlike canzoni
  - Spostamento tracce tra playlist
  - Player con waveform, progress bar, controlli (play/pause/skip)
  - Speed control (slow down / speed up: -5 a +5, 0.5x-1.5x) per ballare

## Changes - Mar 3, 2026 (Session 5)
- ADDED: Music page (/(main)/music.tsx) - libreria musicale completa
- ADDED: Player page (/(main)/player/[id].tsx) - player con waveform e speed control
- ADDED: 9 endpoint backend per musica: genres, playlists CRUD, songs upload/list/like/move/delete
- ADDED: ffprobe per rilevamento durata audio
- ADDED: expo-document-picker per selezione file audio
- ADDED: data-testid su tutti i tab della TabBar

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## Upcoming Tasks
### P1
- Messaggi diretti (DM) - chat 1:1 tra utenti
- Caroselli nei post (multiple foto swipabili)
- Teacher-set lesson prices UI

### P2
- Post/Story video recording
- Calendario disponibilita futura
- Fix autoplay video Reels/Home

### P3/Backlog
- Payment flow (Stripe/PayPal) - MOCKATO
- Google social login
- Follow/Unfollow
