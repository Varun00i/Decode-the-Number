# 🔢 Decode the Number — Multiplayer Game

A real-time, online multiplayer number guessing game. Two players set secret numbers and take turns guessing each other's number with feedback on correct digits and positions.

## 🎮 How to Play

1. Enter your name and choose number length (3–6 digits)
2. **Quick Match** — auto-pair with a random player
3. **Create Room** — get a room code to share with a friend
4. **Join Room** — enter a friend's room code
5. Both players set a secret number (no repeating digits)
6. Take turns guessing — after each guess you see:
   - 📍 How many digits are in the **correct position**
   - 🔢 How many digits are **correct** (any position)
7. First to guess the opponent's number wins!

## 🚀 Deploy to the Internet (FREE)

### Option A: Deploy on Render.com (Recommended)

1. **Install Git** — Download from https://git-scm.com/downloads
2. **Create a GitHub account** — https://github.com (if you don't have one)
3. **Create a new GitHub repository:**
   - Go to https://github.com/new
   - Name it `decode-the-number`
   - Set to **Public**
   - Click **Create repository**
4. **Push your code to GitHub** — Open terminal in this folder and run:
   ```bash
   git init
   git add -A
   git commit -m "Initial commit - Decode the Number"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/decode-the-number.git
   git push -u origin main
   ```
5. **Deploy on Render:**
   - Go to https://render.com and sign up (free, use GitHub login)
   - Click **New** → **Web Service**
   - Connect your GitHub repo `decode-the-number`
   - Settings will auto-fill from `render.yaml`:
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
   - Click **Create Web Service**
   - Wait 2-3 minutes for deployment
   - Your game will be live at `https://decode-the-number-XXXX.onrender.com`

6. **Share the URL** with anyone — they can open it in any browser and play!

### Option B: Deploy on Glitch.com (Easiest — No Git Required)

1. Go to https://glitch.com
2. Click **New Project** → **Import from GitHub** (or **glitch-hello-node**)
3. If importing from GitHub, paste your repo URL
4. If starting fresh:
   - Delete all existing files
   - Upload all files from this project folder (drag & drop)
5. Glitch auto-deploys — your game is live at `https://YOUR-PROJECT.glitch.me`

### Option C: Deploy on Railway.app

1. Go to https://railway.app and sign up with GitHub
2. Click **New Project** → **Deploy from GitHub Repo**
3. Select your `decode-the-number` repo
4. Railway auto-detects Node.js and deploys
5. Click **Generate Domain** to get a public URL

## 🔧 Run Locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser tabs to test.

## 📁 Project Structure

```
├── server.js           # Node.js + Express + Socket.io server
├── package.json        # Dependencies and scripts
├── render.yaml         # Render.com deployment config
├── Procfile            # Heroku/Railway deployment config
├── .gitignore          # Git ignore rules
└── public/
    ├── index.html      # All game screens
    ├── css/
    │   └── style.css   # Vibrant Block Blast-inspired styles
    └── js/
        ├── sounds.js   # Web Audio API sound effects
        ├── chat.js     # Real-time chat with emoji reactions
        └── game.js     # Game logic, stats, particles
```

## ✨ Features

- ⚡ Real-time multiplayer via WebSockets
- 🎯 Turn-based gameplay with live feedback
- 📜 Full guess history visible to both players
- 💬 In-game chat with emoji & message reactions
- 🔊 Interactive tap & joy sounds (toggleable)
- 📊 Player profiles with stats (games, wins, win rate, streaks)
- 🏆 Leaderboard
- 🌐 Online player count
- 🎨 Vibrant, responsive UI with particle animations
- 📱 Works on desktop and mobile
- 🔒 Server-side validation (no cheating)
