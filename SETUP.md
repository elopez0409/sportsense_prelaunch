# 🛠️ SportSense V2 Setup Guide

Follow these steps to replicate the SportSense V2 environment on your local machine.

## 📋 Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Version 18 or higher)
- [Git](https://git-scm.com/)

---

## 🚀 Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/ShryukGrandhi/sportsenseV2.git
cd sportsenseV2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
1. Copy the template file:
   ```bash
   cp env.template .env
   ```
2. Open `.env` and fill in the required keys:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL Connection String | Use [Neon](https://neon.tech) (recommended) or local Postgres |
| `GEMINI_API_KEY` | Google AI API Key | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `NEXTAUTH_SECRET` | Auth Encryption Key | Run `openssl rand -base64 32` in terminal |
| `NEXTAUTH_URL` | App Base URL | `http://localhost:3000` (for local dev) |

**Optional Keys:**
- `UPSTASH_REDIS_REST_URL` & `TOKEN`: For caching (get from [Upstash](https://upstash.com))
- `BALLDONTLIE_API_KEY`: For higher rate limits (get from [Ball Don't Lie](https://balldontlie.io))

### 4. Setup Database
Use Prisma to sync your schema with the database:
```bash
# Generate Prisma client
npm run db:generate

# Push schema to your database (Neon/Postgres)
npm run db:push
```

### 5. Seed Initial Data
Populate your database with initial NBA data:
```bash
npm run sync:full
```
*Note: This might take a few minutes as it fetches teams, players, and games.*

---

## 🏃‍♂️ Running the App

Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐛 Troubleshooting

- **Database Errors?** Ensure your `DATABASE_URL` is correct and the database is running.
- **Missing Data?** Run `npm run sync:games` to fetch the latest schedule.
- **Build Failed?** Run `npm run build` to check for type errors.

---

## 🤝 Contribution Workflow

1. `git pull origin main` (Get latest changes)
2. Create a new branch: `git checkout -b feature/my-feature`
3. Make changes & commit
4. Push & open a Pull Request



