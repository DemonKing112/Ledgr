# Montraq — Smart Expense Tracking for Freelancers

A full-stack SaaS web app that helps freelancers track expenses, manage project budgets, and stay tax-ready.

## Tech Stack

| Layer    | Tech                                                    |
| -------- | ------------------------------------------------------- |
| Frontend | Vanilla HTML / CSS / JS (no build step)                 |
| Backend  | Node.js + Express                                       |
| Database | SQLite (via better-sqlite3) — structured for Postgres swap |
| Auth     | JWT (access + refresh tokens) with bcrypt password hashing |
| Charts   | Chart.js (CDN)                                          |

---

## Quick Start (Local Development)

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd Montraq
```

### 2. Set up the backend

```bash
cd backend
cp .env.example .env        # Create your environment file
npm install                  # Install dependencies
npm run seed                 # Populate the DB with demo data
npm run dev                  # Start the API server on port 3001
```

The seed script creates a demo account you can use right away:
- **Email:** `demo@montraq.app`
- **Password:** `password123`

### 3. Serve the frontend

The frontend is plain HTML — no build step needed. Open it with any static file server:

```bash
# Option A: VS Code Live Server extension (right-click index.html → Open with Live Server)
# Option B: Python
cd frontend
python -m http.server 5500

# Option C: npx
npx serve frontend -l 5500
```

Then open **http://localhost:5500** in your browser.

> **Important:** The frontend expects the backend at `http://localhost:3001`. If you change the backend port, update `API_BASE` in `frontend/js/api.js`.

### 4. Run the tests

```bash
cd backend
npm test
```

---

## Project Structure

```
Montraq/
├── frontend/
│   ├── index.html          Marketing / landing page
│   ├── login.html          Log-in page
│   ├── signup.html         Sign-up page
│   ├── dashboard.html      Post-login expense dashboard
│   ├── css/
│   │   ├── style.css       Main styles (marketing + shared)
│   │   ├── auth.css        Login/signup page styles
│   │   └── dashboard.css   Dashboard-specific styles
│   └── js/
│       ├── api.js          API client (fetch wrapper, token management)
│       ├── main.js         Marketing page interactions (menu, scroll, FAQ)
│       ├── auth.js         Login/signup form handlers
│       └── dashboard.js    Dashboard logic (table, chart, CRUD)
│
├── backend/
│   ├── server.js           Express entry point
│   ├── .env.example        Environment variable template
│   ├── db/
│   │   ├── schema.js       Database tables (SQLite)
│   │   └── seed.js         Demo data generator
│   ├── middleware/
│   │   ├── auth.js         JWT verification middleware
│   │   ├── validate.js     Input validation rules
│   │   └── rateLimiter.js  Rate limiting for auth + API
│   ├── routes/
│   │   ├── auth.js         Signup, login, refresh, logout
│   │   ├── expenses.js     CRUD for expenses
│   │   ├── categories.js   List & create categories
│   │   ├── projects.js     List & create projects
│   │   └── receipts.js     Stubbed receipt-scan endpoint
│   └── tests/
│       └── api.test.js     Auth + expense CRUD tests
│
├── .gitignore
└── README.md
```

---

## Where Placeholders Live

All placeholder content is marked with `[PLACEHOLDER: description]` in the HTML files. Search for `[PLACEHOLDER` to find every spot that needs real copy:

- **`index.html`** — Hero subheadline, trust metric, feature descriptions, pricing taglines, testimonial quote/name, FAQ answers, CTA line, footer description
- **Images** — All images use `https://placehold.co/` URLs sized per section. Replace with real screenshots and photos.
- **Favicon** — Currently a placehold.co image. Replace `<link rel="icon" ...>` in all HTML files.
- **Open Graph image** — Replace the `og:image` meta tag in `index.html`.

---

## API Endpoints

| Method | Endpoint              | Auth | Description                     |
| ------ | --------------------- | ---- | ------------------------------- |
| POST   | /api/auth/signup      | No   | Create a new account            |
| POST   | /api/auth/login       | No   | Log in, get tokens              |
| POST   | /api/auth/refresh     | No   | Exchange refresh token          |
| GET    | /api/auth/me          | Yes  | Get current user profile        |
| POST   | /api/auth/logout      | Yes  | Invalidate refresh tokens       |
| GET    | /api/expenses         | Yes  | List all user expenses          |
| GET    | /api/expenses/summary | Yes  | Spend totals by category        |
| POST   | /api/expenses         | Yes  | Create an expense               |
| PUT    | /api/expenses/:id     | Yes  | Update an expense               |
| DELETE | /api/expenses/:id     | Yes  | Delete an expense               |
| GET    | /api/categories       | Yes  | List user categories            |
| POST   | /api/categories       | Yes  | Create a category               |
| GET    | /api/projects         | Yes  | List user projects              |
| POST   | /api/projects         | Yes  | Create a project                |
| POST   | /api/receipts/scan    | Yes  | Stub — receipt OCR (not yet implemented) |
| GET    | /api/health           | No   | Health check                    |

---

## Deployment

### Frontend → Vercel

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repo
3. Set the **Root Directory** to `frontend`
4. **Framework Preset:** Other (static)
5. **Build Command:** (leave blank — no build step)
6. **Output Directory:** `.`
7. Deploy

### Backend → Render

1. Go to [render.com](https://render.com), create a new **Web Service**
2. Connect your GitHub repo
3. Set the **Root Directory** to `backend`
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. Add environment variables from `.env.example` in the Render dashboard
7. Update `FRONTEND_URL` to your Vercel URL
8. Update `API_BASE` in `frontend/js/api.js` to your Render URL

> **Note:** For production, swap SQLite for Postgres. The SQL is already written with standard syntax to make migration straightforward.

---

## Security Features

- Passwords hashed with bcrypt (12 salt rounds)
- JWT access tokens (15-minute expiry) + refresh tokens (7-day, single-use)
- Rate limiting on auth endpoints (20 attempts per 15 minutes)
- Input validation and sanitization on all endpoints
- Helmet.js for secure HTTP headers
- CORS restricted to the frontend origin
- Parameterized SQL queries (no string concatenation)
- `.env` in `.gitignore` — secrets never committed
