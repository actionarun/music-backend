# Music Streaming App — Backend

Node.js + Express + MongoDB backend for a MERN Music Streaming App.

## Live API
https://music-backend-6990.onrender.com/api

## Setup

npm install
cp .env.example .env   # fill in your own values
npm run dev


## API Documentation
See routes list below / Postman collection.


Email: nanthini2007nanthini@gmail.com
Password: test1234


## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (jsonwebtoken) for authentication
- bcryptjs for password hashing
- Multer for file uploads (audio + cover images)
- Nodemailer for email verification & password reset

## How It Works

1. **Auth** — Users sign up with email/password. A verification email is sent via Nodemailer; the account must be verified before login. JWT tokens are issued on login and required (as a Bearer token) for all private routes.
2. **Songs** — Songs are uploaded as `multipart/form-data` (audio file + optional cover image) via Multer, stored on disk under `uploads/`, and served back through a streaming endpoint that supports HTTP Range requests (so the frontend `<audio>` player can seek smoothly).
3. **Search** — Songs can be searched by title, artist, album, or movie name using a case-insensitive regex query.
4. **Playlists** — Users can create playlists, add/remove songs, mark them public/private, and like public playlists created by others.
5. **Social features** — Songs and playlists support likes and comments, both tied to the authenticated user.
6. **CORS** — Configured to allow requests only from approved origins (`localhost` for local dev + the deployed frontend URL, set via the `CLIENT_URL` environment variable).

## Project Structure

backend/
├── config/db.js # MongoDB connection
├── models/ # User, Song, Playlist schemas
├── middleware/
│ ├── authMiddleware.js # JWT verification (protect / optionalAuth)
│ └── uploadMiddleware.js # Multer config for audio/cover uploads
├── controllers/ # Route logic (auth, song, playlist)
├── routes/ # Express routers
├── utils/sendEmail.js # Nodemailer wrapper
├── uploads/songs, uploads/covers # Uploaded files (created at runtime)
└── index.js # App entry point