# BEAT MATES - Product Requirements Document

## Tech Stack
- Frontend: React Native (Expo SDK 54), TypeScript, Zustand, Expo Router, react-native-webview, expo-av (audio only)
- Backend: Python 3, FastAPI, Uvicorn, motor (async MongoDB)
- Database: MongoDB
- Video Calls: Daily.co (WebRTC via daily-js SDK in WebView, auto-join senza pre-join UI)
- Thumbnails: ffmpeg (first frame extraction, cached as _thumb.jpg)
- Media: Direct file serving via /api/uploads/ endpoint

## What's Implemented
- User registration & login (JWT), dance categories, social feed, stories, profiles
- Video playback via WebView with HTML5 <video> tag (DO NOT CHANGE)
- Videos served as direct MP4 files from /api/uploads/
- Daily.co video call: auto-join immediato senza popup (JS SDK)
- Story viewer Instagram-like: progress bar, auto-advance, swipe tra utenti
- Video thumbnails generati con ffmpeg nel profilo
- Notifiche lezione: Modal a schermo intero bloccante (accetta/rifiuta)
- Hamburger menu profilo Instagram-style (slide-up sheet)
- Like con thumbnail profilo recenti (stile Instagram: "Piace a X e altri Y")
- Camera verticale (9:16) per video post e storie

## Changes - Mar 2, 2026 (Session 4)
- ADDED: Hamburger menu profilo - Modal slide-up con: Attivita, Archivio, Salvati, Preferiti, Amici Stretti, Toggle Disponibilita, Impostazioni, Esci
- FIXED: Video call auto-join - Usa Daily.co JS SDK (daily-js CDN) per auto-join immediato, enable_prejoin_ui:false
- REWRITTEN: Notifica lezione - Modal a schermo intero bloccante con vibrazione continua + suono, Accept/Reject obbligatorio
- ADDED: Like con thumbnails - PostCard mostra mini foto profilo dei likers + "Piace a X e altri Y"
- ADDED: Backend /api/posts/{post_id}/likers + recent_likers nel feed
- FIXED: Bottone Messaggio nel profilo utente (placeholder con alert)
- FIXED: @username mostrato nell'header del profilo

## Changes - Mar 2, 2026 (Session 3)
- Story viewer rewrite (progress bars, sequenziale, swipe)
- Video thumbnails con ffmpeg
- Profilo: storie reali al posto di mock
- Camera 9:16 verticale

## Test Credentials
- mario@test.com / password123 (student)
- teacher@test.com / password123 (teacher)

## Pending/Known Issues
### P2
- Reels page: solo il primo video autoplay
- Home page: video partono dopo navigazione via-ritorno

## Upcoming Tasks
### P1
- Messaggi diretti (DM) - chat 1:1 tra utenti
- Caroselli nei post (multiple foto swipabili)
- Teacher-set lesson prices UI (hourly_rate)

### P2
- Post/Story video recording dalla camera
- Calendario disponibilita futura

### P3/Backlog
- Payment flow (Stripe/PayPal) - attualmente MOCKATO
- Google social login
- Pagina Musica
- Follow/Unfollow
- Refactoring: cleanup test files in /app root

## External Services
- Daily.co: Video calls (API key in backend/.env, auto-join via JS SDK)
- MongoDB: Database (MONGO_URL in backend/.env)
- ffmpeg: Video thumbnail generation
