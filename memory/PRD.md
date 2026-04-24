# BEAT MATES - Product Requirements Document

## Original Problem Statement
Social media mobile app per ballerini ("BEAT MATES"):
- Registrazione/login (Email/Google)
- Social feed filtrabile per discipline di danza, video autoplay, caroselli
- Stories Instagram-like e messaggi diretti (Chat)
- Profili utente con griglia post e shop e-commerce di video lezioni
- Video lezioni 1-to-1 Live con strumenti di coaching (drawing su video)
- Lezioni di gruppo con scheduling insegnanti e ingresso via Daily.co
- Sezione Music con playlist e controlli velocità
- Push Notifications e Stripe (pagamenti reali + split 80/20 teachers)
- Ad system (Sponsorizzate) in Feed, Stories e Prerolls

**Lingua primaria utente**: Italiano

## Tech Stack
- **Frontend**: React Native + Expo SDK, TestFlight per produzione, Expo Go per dev
- **Backend**: FastAPI + MongoDB, deployato su OVH VPS (Ubuntu) via Docker
- **Media**: BunnyCDN (Storage + Stream) per global edge delivery
- **Video calls**: Daily.co WebRTC (WebView injection)
- **Deploy SSH**: `ssh ubuntu@57.128.225.167`, cartella `/home/ubuntu/beat-mates-app`

## Completed (Feb 2026 session)
- ✅ Fix velocità upload storie/post: limite re-encoding FFmpeg alzato da 5MB → 50MB (fast-path per video iPhone HEVC moderni)
- ✅ Fix coaching black screen Asia: upload clip coaching anche su Bunny CDN (edge globale, latenza 5-10ms Hong Kong vs 250ms OVH)
- ✅ Deploy backend OVH sbloccato (risolti conflitti git + docker-compose 1.29.2 bug ContainerConfig)

## Currently Active Fixes (Deployed)
- Backend OVH: `docker-compose up --build -d` con server.py patchato in loco
- Coaching uploads ora usano Bunny CDN con fallback locale

## Known Issues (Pending / Backlog)
- P1: Mentions list vuota in Story Editor
- P1: ReviewsPopup.tsx Carousel swipe rotto
- P1: Share Modal (airplane icon) non funziona
- P2: Migrazione completa da `expo-av` → `expo-video` (installato ma non usato ovunque)
- P2: Daily.co brittle WebView injection → dovrebbe migrare a `@daily-co/react-native-daily-js`

## Roadmap
### P1 (prossimi)
- Stripe Connect integration (pagamenti reali, split 80/20 teachers)
- Admin Dashboard web (React/Next.js) per gestione utenti/ads/finanze

### P2 (future)
- Push Notifications native (Expo Notifications / APNs)
- Social Login Google/Meta
- AI moderation contenuti inappropriati
- Refactoring `backend/server.py` (>4400 righe) in router modulari

## Credentials (Test)
- Admin/Student: `fabriziocavada@gmail.com` / `abc123!`
- Teacher: `teacher2@beatmates.app` / `Test1234`

## Key Architecture Notes
- `backend/server.py` è monolitico (~4400 righe) — da rifattorizzare in router
- `frontend/app/(main)/video-call/[id].tsx` rollback a versione stabile Marzo 2026 (timer 15min + bottone Annulla)
- Endpoint coaching: `POST /api/coaching/{session_id}/upload` ora carica su Bunny CDN
- Endpoint storie: `POST /api/upload` con fast-path <50MB per video

## Deployment Flow (OVH)
1. Modifica `backend/server.py` locale o via patch script
2. `sudo docker-compose down && sudo docker-compose up --build -d`
3. `sudo docker-compose logs --tail=30 backend` per verifica
4. Test da Expo Go (dev) o TestFlight (prod)
