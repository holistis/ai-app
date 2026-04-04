# Clerk Authentication Setup Guide

This project has been updated to use **Clerk** for authentication instead of Manus OAuth.

## What Changed

### Backend
- `server/_core/oauth.ts` - Replaced Manus OAuth with Clerk stub
- `server/_core/context.ts` - Uses Clerk auth from request
- `server/db.ts` - Added `getUserByClerkId()` and `upsertUserFromClerk()` functions
- `server/_core/index.ts` - Updated PDF endpoint to use Clerk authentication

### Frontend
- `client/src/main.tsx` - Wrapped app with `<ClerkProvider>`
- `client/src/_core/hooks/useAuth.ts` - Integrated with Clerk's `useAuth()` hook
- `client/src/const.ts` - Updated login URL to `/sign-in`

### Database
- `drizzle/schema.ts` - Added `clerkId` field to users table
- Made `openId` field optional for backward compatibility

## Installation & Setup

### 1. Install Dependencies
```bash
pnpm install
```

Clerk packages are already in `package.json`:
- `@clerk/clerk-react` (frontend)
- `@clerk/clerk-sdk-node` (backend)

### 2. Get Clerk API Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select existing one
3. Copy your credentials:
   - **Secret Key** → `CLERK_SECRET_KEY`
   - **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY`

### 3. Configure Environment Variables

Create `.env` file in project root:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/holistisch_ai_clinic

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_secret_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Other existing variables (keep as-is)
JWT_SECRET=your_jwt_secret
OWNER_OPEN_ID=your_owner_id
OWNER_NAME=Your Name
RESEND_API_KEY=your_resend_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Run Database Migrations

```bash
# Generate migration for new clerkId field
pnpm drizzle-kit generate

# Review the generated SQL in drizzle/ folder
# Then apply the migration
pnpm drizzle-kit migrate
```

### 5. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173` (frontend) and `http://localhost:3000` (backend).

## Testing Clerk Authentication

1. Navigate to `http://localhost:5173`
2. Click "Sign In" button (redirects to `/sign-in`)
3. Clerk sign-in page appears
4. Sign in with email/password or social login
5. After successful login, user is synced to database via `getUserByClerkId()`

## User Sync Flow

When a user signs in with Clerk:

1. Frontend receives Clerk session
2. Backend context extracts `userId` from Clerk auth
3. `getUserByClerkId(userId)` looks up user in database
4. If user doesn't exist, they must be created via webhook or manual sync
5. User data is available in tRPC context as `ctx.user`

## Creating Admin Users

To make a user an admin:

```sql
UPDATE users SET role = 'admin' WHERE clerkId = 'user_xxxxx';
```

Get the `clerkId` from Clerk Dashboard or from database after user's first login.

## Webhook Setup (Optional but Recommended)

Set up Clerk webhooks to auto-sync users:

1. Go to Clerk Dashboard → Webhooks
2. Create webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`

The backend already has a webhook handler at `/api/webhooks/clerk` that syncs user data.

## Migration from Manus OAuth

If migrating from existing Manus OAuth setup:

1. **Keep existing data**: `openId` field remains optional
2. **Map old users**: Run script to link `openId` users to new Clerk IDs
3. **Test thoroughly**: Verify all reports and payments still work

### Migration Script Example

```sql
-- Link existing Manus users to Clerk (manual process)
-- You'll need to map each openId to a clerkId from Clerk Dashboard

UPDATE users 
SET clerkId = 'user_xxxxx' 
WHERE openId = 'manus_user_id' AND clerkId IS NULL;
```

## Troubleshooting

### "Clerk publishable key not found"
- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env`
- Check it's prefixed with `pk_test_` or `pk_live_`

### "User not found in database"
- First-time users need to be created
- Check webhook is working or manually create user record

### "Unauthorized" on PDF download
- Verify Clerk auth token is being sent
- Check `ctx.user` is populated in context

### Database migration fails
- Ensure MySQL is running and `DATABASE_URL` is correct
- Check `clerkId` column doesn't already exist
- Review generated SQL before applying

## Deployment

### Environment Variables for Production

Set these in your deployment platform:

```
CLERK_SECRET_KEY=sk_live_your_production_key
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
DATABASE_URL=mysql://prod_user:prod_password@prod_host:3306/db
NODE_ENV=production
```

### Vercel Deployment

```bash
vercel env add CLERK_SECRET_KEY
vercel env add VITE_CLERK_PUBLISHABLE_KEY
vercel deploy
```

### Railway Deployment

```bash
railway link
railway variables set CLERK_SECRET_KEY=sk_live_...
railway variables set VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
railway deploy
```

## Documentation

- [Clerk Docs](https://clerk.com/docs)
- [Clerk React SDK](https://clerk.com/docs/references/react/use-auth)
- [Clerk Node SDK](https://clerk.com/docs/references/backend/overview)

## Support

For Clerk-specific issues, visit [Clerk Support](https://support.clerk.com)

---

**Version**: Clerk Integration v1.0
**Date**: 2026-04-04
**Status**: Ready for development
