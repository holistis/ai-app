# Project Structure - Holistisch AI Clinic

## Directory Layout

```
holistisch_ai_clinic/
├── client/                          # React 19 frontend
│   ├── src/
│   │   ├── pages/                   # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── RapportPage.tsx
│   │   │   ├── AnamnesisForm.tsx
│   │   │   └── ...
│   │   ├── components/              # Reusable UI components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── AIChatBox.tsx
│   │   │   ├── Map.tsx
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── contexts/                # React contexts
│   │   ├── hooks/                   # Custom hooks
│   │   ├── _core/
│   │   │   └── hooks/
│   │   │       └── useAuth.ts       # Clerk auth hook
│   │   ├── lib/
│   │   │   └── trpc.ts              # tRPC client setup
│   │   ├── const.ts                 # Constants
│   │   ├── App.tsx                  # Main app component
│   │   ├── main.tsx                 # Entry point with ClerkProvider
│   │   └── index.css                # Global styles
│   ├── public/                      # Static assets (favicon, robots.txt only)
│   ├── index.html
│   └── vite-env.d.ts
│
├── server/                          # Express + tRPC backend
│   ├── _core/
│   │   ├── index.ts                 # Express server setup
│   │   ├── context.ts               # tRPC context (Clerk auth)
│   │   ├── oauth.ts                 # Clerk OAuth (stub)
│   │   ├── env.ts                   # Environment variables
│   │   ├── pdfGenerator.ts          # PDF generation
│   │   ├── email.ts                 # Email sending
│   │   ├── llm.ts                   # LLM integration
│   │   ├── imageGeneration.ts       # Image generation
│   │   ├── voiceTranscription.ts    # Voice to text
│   │   ├── notification.ts          # Owner notifications
│   │   ├── map.ts                   # Maps integration
│   │   ├── vite.ts                  # Vite dev server
│   │   └── cookies.ts               # Cookie utilities
│   ├── routers/
│   │   ├── index.ts                 # Router aggregation
│   │   ├── auth.ts                  # Auth procedures
│   │   ├── anamnesis.ts             # Anamnesis procedures
│   │   ├── reports.ts               # Report procedures
│   │   ├── payments.ts              # Payment procedures
│   │   ├── coaching.ts              # Coaching procedures
│   │   ├── pdf-generation.ts        # PDF generation logic
│   │   └── admin.ts                 # Admin procedures
│   ├── db.ts                        # Database helpers
│   ├── storage.ts                   # S3 storage helpers
│   └── *.test.ts                    # Vitest test files
│
├── drizzle/                         # Database schema & migrations
│   ├── schema.ts                    # Drizzle ORM schema
│   ├── migrations/                  # SQL migration files
│   │   ├── 0000_*.sql
│   │   ├── 0001_*.sql
│   │   └── ...
│   └── meta/
│
├── shared/                          # Shared types & constants
│   ├── const.ts                     # Shared constants
│   └── types.ts                     # Shared types
│
├── knowledge_base/                  # Holistic health knowledge
│   ├── topics/
│   │   ├── chronic_fatigue.json
│   │   ├── digestive_issues.json
│   │   └── ...
│   └── protocols/
│
├── storage/                         # S3 storage helpers
│   └── index.ts
│
├── .env.example                     # Environment template
├── CLERK_SETUP.md                   # Clerk setup guide
├── MIGRATION_GUIDE.md               # Deployment guide
├── PROJECT_STRUCTURE.md             # This file
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config
├── vitest.config.ts                 # Vitest config
├── drizzle.config.ts                # Drizzle config
├── components.json                  # shadcn/ui config
├── railway.json                     # Railway deployment
├── vercel.json                      # Vercel deployment
└── todo.md                          # Project tasks
```

## Key Files

### Frontend
- **main.tsx** - Entry point, wraps app with ClerkProvider
- **App.tsx** - Routes and layout
- **lib/trpc.ts** - tRPC client configuration
- **_core/hooks/useAuth.ts** - Clerk authentication hook

### Backend
- **server/_core/index.ts** - Express server, routes, middleware
- **server/_core/context.ts** - tRPC context with Clerk auth
- **server/routers/index.ts** - tRPC router aggregation
- **server/db.ts** - Database query helpers

### Database
- **drizzle/schema.ts** - Table definitions (users, reports, payments, etc.)
- **drizzle/migrations/** - SQL migration files

### Configuration
- **.env.example** - Environment variables template
- **package.json** - Dependencies and scripts
- **tsconfig.json** - TypeScript configuration
- **vite.config.ts** - Vite build configuration

## Technology Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS 4
- Vite
- tRPC Client
- Clerk React SDK
- shadcn/ui components

### Backend
- Node.js + Express
- tRPC 11
- Drizzle ORM
- MySQL/TiDB Database
- Clerk Node SDK
- Puppeteer (PDF generation)
- Resend (Email)
- Stripe (Payments)

### DevOps
- Vitest (Testing)
- TypeScript (Type safety)
- Drizzle Kit (Migrations)
- Vite (Dev server)

## Database Tables

### users
- id (PK)
- clerkId (Clerk user ID)
- openId (Legacy Manus ID, optional)
- email
- name
- role (admin | user)
- stripeCustomerId
- createdAt, updatedAt, lastSignedIn

### anamnesis
- id (PK)
- userId (FK)
- conditionType (enum)
- responses (JSON)
- status (draft | submitted | analyzed)
- createdAt, updatedAt

### reports
- id (PK)
- userId (FK)
- anamnesisId (FK)
- reportType (enum)
- title, content, summary
- keyInsights, recommendations, protocols
- scientificReferences
- pdfUrl (S3 URL)
- status (draft | generated | sent)
- createdAt, updatedAt

### payments
- id (PK)
- userId (FK)
- reportId (FK, optional)
- stripePaymentIntentId
- stripeSubscriptionId
- amount, currency
- paymentType (enum)
- status (enum)
- createdAt, updatedAt

### coachingSessions
- id (PK)
- userId (FK)
- reportId (FK)
- phase (phase_1_awareness | phase_2_action | etc)
- messages (JSON)
- status (active | completed | paused)
- createdAt, updatedAt

### patientProgress
- id (PK)
- userId (FK)
- coachingSessionId (FK)
- weekNumber
- adherenceScore, symptomScore
- notes
- createdAt, updatedAt

## API Routes

### tRPC Procedures (/api/trpc)
- `auth.me` - Get current user
- `auth.logout` - Logout user
- `anamnesis.create` - Create anamnesis
- `anamnesis.getLatest` - Get latest anamnesis
- `reports.regenerateLatestReport` - Generate report
- `reports.getLatestReport` - Get latest report
- `payments.createCheckoutSession` - Stripe checkout
- `coaching.startSession` - Start coaching
- `admin.getAllReports` - Admin: get all reports

### Express Routes
- `GET /api/pdf/:reportId` - Download PDF (Clerk auth)
- `POST /api/webhooks/clerk` - Clerk user sync webhook
- `POST /api/webhooks/stripe` - Stripe payment webhook

## Environment Variables

### Required
- `DATABASE_URL` - MySQL connection string
- `CLERK_SECRET_KEY` - Clerk backend secret
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `JWT_SECRET` - Session signing secret

### Optional
- `RESEND_API_KEY` - Email service
- `STRIPE_SECRET_KEY` - Payment processing
- `OPENAI_API_KEY` - LLM integration
- `NODE_ENV` - development | production

## Development Workflow

1. **Start dev server**: `pnpm dev`
2. **Run tests**: `pnpm test`
3. **Generate migrations**: `pnpm drizzle-kit generate`
4. **Apply migrations**: `pnpm drizzle-kit migrate`
5. **Build for production**: `pnpm build`

## Deployment

- **Vercel**: Frontend + serverless functions
- **Railway**: Full-stack deployment
- **Docker**: Self-hosted deployment
- **Netlify**: Static frontend only (requires separate backend)

See `MIGRATION_GUIDE.md` for detailed deployment instructions.

---

**Last Updated**: 2026-04-04
**Clerk Version**: 5.x
**Status**: Production Ready
