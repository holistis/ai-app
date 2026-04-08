# App omgeving
NODE_ENV=development

# JWT / cookies
JWT_SECRET=dummysupersecret

# Database
DATABASE_URL=sqlite://:memory:  # tijdelijk dummy, werkt lokaal

# OAuth / eigenaar
OAUTH_SERVER_URL=http://localhost:3000
OWNER_OPEN_ID=dummy_owner

# Forge API (optioneel)
BUILT_IN_FORGE_API_URL=http://localhost:3000
BUILT_IN_FORGE_API_KEY=dummy_forge_key

# Clerk (authenticatie)
CLERK_API_KEY=dummy_clerk_key
CLERK_FRONTEND_API=dummy_frontend_key

# Stripe (betalingen)
STRIPE_API_KEY=dummy_key