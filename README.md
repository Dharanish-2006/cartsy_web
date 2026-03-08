# Cartsy Frontend

A modern React + Vite frontend for the Cartsy e-commerce platform.

## Tech Stack

- **React 18** + **Vite 5**
- **React Router v6** — client-side routing
- **Framer Motion** — animations & transitions
- **Axios** — API requests with JWT auth interceptor
- **React Hot Toast** — beautiful notifications
- **Lucide React** — icon library
- **CSS Modules** — scoped styling with a design system

## Design System

- Dark-first with animated mesh gradient background
- **Syne** (display) + **DM Sans** (body) — distinctive type pairing
- Purple/indigo accent (`#7c6aff`) with pink/mint secondaries
- Fluid responsive layouts — works on all screen sizes

## Project Structure

```
src/
├── context/
│   ├── AuthContext.jsx     — JWT auth state (login/logout)
│   └── CartContext.jsx     — Cart item count
├── utils/
│   └── api.js              — Axios instance + auth interceptor
├── components/
│   ├── Navbar.jsx          — Sticky nav with mobile menu
│   ├── ProductCard.jsx     — Animated product card
│   └── ProtectedRoute.jsx  — Auth guard
├── pages/
│   ├── Home.jsx            — Hero + product grid
│   ├── Login.jsx           — Email/password login
│   ├── Signup.jsx          — Registration
│   ├── VerifyOTP.jsx       — 6-digit OTP verification
│   ├── ProductDetail.jsx   — Image gallery + add to cart
│   ├── Cart.jsx            — Cart management
│   ├── Checkout.jsx        — COD + Razorpay checkout
│   └── Orders.jsx          — Order history
└── App.jsx                 — Router + providers
```

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Edit .env and set VITE_API_URL to your Django backend URL

# Start dev server (proxies /api and /orders to Django)
npm run dev

# Build for production
npm run build
```

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup/` | Register user |
| POST | `/api/login/` | Login, returns JWT |
| POST | `/api/verify-otp/` | Verify email OTP |
| GET | `/api/home/` | Product listing |
| GET | `/api/products/:id/` | Product detail |
| GET/POST | `/api/cart/` | View/add cart |
| POST | `/api/cart/update/` | Change quantity |
| GET | `/api/orders/` | Order history |
| POST | `/api/orders/create/` | Place COD order |
| POST | `/api/orders/razorpay/` | Create Razorpay order |
| POST | `/orders/razorpay/verify/` | Verify payment |

## Deployment

Point `VITE_API_URL` to your deployed Django backend URL (e.g., `https://cartsy-ht0x.onrender.com`).

For Vercel/Netlify: configure rewrites to handle SPA routing.
