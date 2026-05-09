# Pulse — Social Media API

> A production-grade social media REST API built with Node.js, Express, MongoDB, and JWT authentication.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Folder Structure](#folder-structure)
- [Tech Stack](#tech-stack)
- [Getting Started (Local Setup)](#getting-started-local-setup)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Running Tests](#running-tests)
- [Deploying to Render (Free Hosting)](#deploying-to-render-free-hosting)
- [Pushing to GitHub](#pushing-to-github)
- [Features Checklist](#features-checklist)

---

## Project Overview

**Pulse** is a social media backend API that allows users to:
- Register and authenticate using JWT
- Create, draft, publish, edit, and delete posts
- Like and unlike posts
- Follow and unfollow other users
- View a personalized feed from followed users
- Browse all published posts with search, filtering, sorting, and pagination

Both logged-in and non-logged-in users can view public content.

---

## Folder Structure

```
social-app/
│
├── public/
│   └── index.html              ← Beautiful UI (served at /)
│
├── src/
│   ├── app.js                  ← Express app entry point
│   │
│   ├── config/
│   │   └── database.js         ← MongoDB connection
│   │
│   ├── models/
│   │   ├── User.js             ← User schema (auth, profile)
│   │   ├── Post.js             ← Post schema (title, content, state...)
│   │   ├── Follow.js           ← Follow relationships
│   │   └── Like.js             ← Post likes
│   │
│   ├── middleware/
│   │   └── auth.js             ← JWT protect + optionalAuth middleware
│   │
│   ├── controllers/
│   │   ├── authController.js   ← signup, signin, getMe
│   │   ├── postController.js   ← CRUD, feed, like/unlike
│   │   └── userController.js   ← profile, follow, followers/following
│   │
│   └── routes/
│       ├── auth.js             ← /api/auth/*
│       ├── posts.js            ← /api/posts/*
│       └── users.js            ← /api/users/*
│
├── tests/
│   ├── helpers.js              ← In-memory DB setup for tests
│   ├── auth.test.js            ← Auth endpoint tests
│   ├── posts.test.js           ← Post endpoint tests
│   └── users.test.js           ← User & follow endpoint tests
│
├── .env.example                ← Environment variable template
├── package.json
└── README.md
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js + Express | Server & routing |
| MongoDB + Mongoose | Database + ODM |
| bcryptjs | Password hashing (salt 12) |
| jsonwebtoken | JWT auth (1hr expiry) |
| cors | Cross-origin requests |
| dotenv | Environment variables |
| Jest + Supertest | Integration testing |
| mongodb-memory-server | In-memory DB for tests |

---

## Getting Started (Local Setup)

### Prerequisites
- Node.js v18+ installed
- MongoDB running locally OR a MongoDB Atlas URI

### Step 1 — Clone the project (after you push to GitHub)
```bash
git clone https://github.com/YOUR_USERNAME/social-app-api.git
cd social-app-api
```

### Step 2 — Install dependencies
```bash
npm install
```

### Step 3 — Set up environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in your values (see below).

### Step 4 — Start the server
```bash
# Development (with auto-restart if you install nodemon)
npm run dev

# Production
npm start
```

The server runs on `http://localhost:5000` by default.

---

## Environment Variables

Create a `.env` file in the root of the project:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/social_app
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=1h
NODE_ENV=development
```

For MongoDB Atlas, use your connection string:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/social_app
```

---

## API Documentation

### Base URL
- Local: `http://localhost:5000/api`
- Hosted: `https://your-app-name.onrender.com/api`

### Authentication
Protected routes require a Bearer token in the header:
```
Authorization: Bearer <your_token>
```
Token expires after **1 hour**.

---

### Auth Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register new user |
| POST | `/api/auth/signin` | Public | Login, get token |
| GET | `/api/auth/me` | 🔒 Required | Get current user |

**Signup body:**
```json
{
  "first_name": "Ada",
  "last_name": "Lovelace",
  "username": "ada_lovelace",
  "email": "ada@example.com",
  "password": "securepassword",
  "bio": "Optional bio text"
}
```

**Signin body:**
```json
{
  "email": "ada@example.com",
  "password": "securepassword"
}
```

---

### Post Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/posts` | Public | List all published posts |
| GET | `/api/posts/:id` | Public | Get single published post |
| POST | `/api/posts` | 🔒 Required | Create new post (draft) |
| PATCH | `/api/posts/:id` | 🔒 Owner | Edit post |
| PATCH | `/api/posts/:id/publish` | 🔒 Owner | Publish a draft |
| DELETE | `/api/posts/:id` | 🔒 Owner | Delete post |
| GET | `/api/posts/me` | 🔒 Required | Get own posts |
| GET | `/api/posts/feed` | 🔒 Required | Personalized feed |
| POST | `/api/posts/:id/like` | 🔒 Required | Like a post |
| DELETE | `/api/posts/:id/like` | 🔒 Required | Unlike a post |

**Query params for `GET /api/posts`:**

| Param | Example | Description |
|---|---|---|
| `search` | `?search=javascript` | Search by title, tags, or author |
| `tag` | `?tag=nodejs` | Filter by exact tag |
| `sort` | `?sort=like_count` | Sort: `like_count`, `comment_count`, `timestamp` |
| `page` | `?page=2` | Page number (default: 1) |
| `limit` | `?limit=10` | Posts per page (default: 20, max: 100) |

**Create post body:**
```json
{
  "title": "My First Post",
  "content": "Post content goes here...",
  "tags": ["nodejs", "api", "express"]
}
```

---

### User Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/:username` | Public | Get user profile |
| POST | `/api/users/:id/follow` | 🔒 Required | Follow a user |
| DELETE | `/api/users/:id/follow` | 🔒 Required | Unfollow a user |
| GET | `/api/users/me/following` | 🔒 Required | List users you follow |
| GET | `/api/users/me/followers` | 🔒 Required | List your followers |

---

### Response Format

All responses follow this shape:

**Success:**
```json
{
  "success": true,
  "token": "...",
  "user": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Descriptive error message here."
}
```

**Paginated list:**
```json
{
  "success": true,
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "posts": [ ... ]
}
```

---

## Running Tests

Tests use **Jest + Supertest** with an in-memory MongoDB instance (no real database needed).

```bash
npm test
```

Test files:
- `tests/auth.test.js` — 10 tests for signup, signin, getMe
- `tests/posts.test.js` — 30+ tests for CRUD, publish, like, feed
- `tests/users.test.js` — 15+ tests for follow, unfollow, followers, following

**Note:** The first run downloads a MongoDB binary (~80MB). Subsequent runs are fast.

---

## Deploying to Render (Free Hosting)

### Step 1 — Push code to GitHub first (see below)

### Step 2 — Create a MongoDB Atlas database (free)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas/database)
2. Create a free cluster
3. Create a database user
4. Whitelist `0.0.0.0/0` (all IPs) in Network Access
5. Copy your connection string

### Step 3 — Deploy on Render
1. Go to [render.com](https://render.com) and sign up
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these options:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables:
   - `MONGO_URI` = your Atlas connection string
   - `JWT_SECRET` = any long random string
   - `JWT_EXPIRES_IN` = `1h`
   - `NODE_ENV` = `production`
6. Click **Create Web Service**

Your API will be live at `https://your-app-name.onrender.com`

---

## Pushing to GitHub

```bash
# Step 1: Initialize git (only if not done)
git init

# Step 2: Create a .gitignore file
echo "node_modules/\n.env\n.DS_Store\n*.log" > .gitignore

# Step 3: Stage all files
git add .

# Step 4: First commit
git commit -m "feat: initial social media API implementation"

# Step 5: Create a repo on GitHub, then connect it
git remote add origin https://github.com/YOUR_USERNAME/social-app-api.git

# Step 6: Push
git branch -M main
git push -u origin main
```

---

## Features Checklist

All 28 requirements from the project brief have been implemented:

- [x] Users have: first_name, last_name, username, email, password, bio, avatar_url
- [x] Sign up creates account and returns JWT
- [x] Sign in validates credentials and returns JWT
- [x] JWT expires after 1 hour
- [x] Posts have: title, content, author, tags, timestamp, state, like_count, comment_count
- [x] Posts start in **draft** state on creation
- [x] Owner can publish a draft post
- [x] Owner can edit post in any state
- [x] Owner can delete post in any state
- [x] Public list of published posts (no login needed)
- [x] Public single post endpoint (no login needed)
- [x] Public list is paginated (default 20 per page)
- [x] Public list is searchable by author, title, and tags
- [x] Public list is sortable by like_count, comment_count, timestamp
- [x] Single post returns author information embedded
- [x] Logged-in user can create a post
- [x] Logged-in user can view their own posts (all states)
- [x] Own posts endpoint is paginated and filterable by state
- [x] Users can follow other users
- [x] Users cannot follow themselves
- [x] Users cannot follow the same user twice
- [x] Users can unfollow users they follow
- [x] User can get list of people they follow
- [x] User can get list of their followers
- [x] Users can like a post
- [x] Users cannot like the same post more than once
- [x] Users can unlike a post
- [x] Tests written for all endpoints
- [x] UI added as a bonus (served at `/`)

---

*Built for the Backend NodeJS Second Semester Examination · Deadline: 10th May 2026*
