# Holistisch AI Kliniek - Project TODO

## Phase 1: Project Setup & Database Schema
- [ ] Design and implement database schema (users, anamnesis, reports, payments, coaching sessions)
- [ ] Create Drizzle ORM schema file with all tables and relationships
- [ ] Generate and apply database migrations
- [ ] Set up environment variables for OpenAI API, Stripe, and other services
- [ ] Create initial project structure and file organization

## Phase 2: Interactive Anamnese Questionnaire
- [x] Design questionnaire UI with multi-step form (Physical, Mental, Energetic sections)
- [x] Focus on: Chronic Fatigue, Digestive Issues, SOLK, ALK
- [x] Implement form validation and progress tracking
- [x] Create anamnesis data collection endpoint
- [x] Add form state management and error handling
- [x] Build responsive mobile-friendly questionnaire interface
- [ ] Add save/resume functionality for incomplete questionnaires

## Phase 3: AI-Driven Analysis & 'Foot in the Door' Report
- [x] Create AI prompt engineering for analyzing anamnesis data
- [x] Implement 'Foot in the Door' report generation (20% preview)
- [ ] Integrate scientific reference lookup and citation
- [x] Create report display UI with markdown rendering
- [x] Add conversion CTA (call-to-action) to upgrade to full report
- [ ] Test AI analysis with sample anamnesis data

## Phase 4: Full Report Generation
- [x] Design full report template with all sections
- [x] Implement detailed underlying causes analysis
- [x] Create personalized protocol generation (nutrition, supplements, lifestyle, mental practices)
- [x] Add scientific reference integration and formatting
- [x] Implement PDF generation for reports
- [x] Create report storage and retrieval system
- [ ] Add report versioning and history tracking

## Phase 5: Stripe Payment Integration
- [x] Set up Stripe account (gratis account for now)
- [x] Implement Stripe payment processing for reports
  - Foot in the Door: €9,95 (FREE)
  - Full Report: €34,95
- [ ] Implement Stripe payment processing for AI coaching (€20/month)
- [x] Create payment success/failure handling
- [ ] Add invoice generation and email notifications (info@holistischadviseur.nl)
- [ ] Implement payment history and receipt management
- [ ] Add refund handling logic

## Phase 6: User Reports & History
- [x] Create "Mijn Rapporten" page for viewing report history
- [x] Implement report listing and filtering
- [x] Add delete report functionality
- [ ] Add report sharing (email/WhatsApp)
- [ ] Add PDF download for reports

## Phase 6b: AI-Coach Feature
- [x] Design AI-coach conversation interface
- [x] Implement chat-based guidance system with LLM
- [x] Create coaching session tracking and history
- [ ] Add progress monitoring and milestone tracking
- [x] Implement personalized coaching prompts based on report data
- [x] Create coaching session storage in database
- [ ] Add coaching session pricing and access control

## Phase 7: Admin Dashboard
- [x] Design admin dashboard layout and navigation
- [x] Implement patient list view with search and filtering
- [ ] Create patient profile view with anamnesis and report history
- [x] Add report management (view, download, delete)
- [ ] Implement payment tracking and analytics
- [x] Add user role management (admin/user)
- [ ] Create analytics dashboard (reports generated, revenue, etc.)
- [x] Add coaching session management

## Phase 8: Testing, Optimization & Launch
- [x] Write unit tests for critical functions (reports + coach routers)
- [x] All tests passing (9/9 tests)
- [ ] Test complete user flow (questionnaire → report → payment → coaching)
- [x] Test AI report generation with various anamnesis inputs
- [ ] Test Stripe payment processing (test and live modes)
- [ ] Optimize performance (API response times, PDF generation)
- [ ] Security audit (authentication, authorization, data protection)
- [ ] User acceptance testing
- [ ] Deploy to production

## Design & UX
- [ ] Choose design style (professional, trustworthy, holistic aesthetic)
- [ ] Define color palette and typography
- [ ] Create design system and component library
- [ ] Design landing page with value proposition
- [ ] Create user onboarding flow
- [x] Design error states and loading states
- [ ] Implement responsive design for all screen sizes

## Documentation
- [ ] Write API documentation
- [ ] Create user guide for questionnaire
- [ ] Document AI analysis methodology
- [ ] Create admin guide for dashboard
- [ ] Write deployment documentation

## CONFIGURATION
- Email: info@holistischadviseur.nl
- Website: www.holistischadviseur.nl
- Prices:
  - Foot in the Door Rapport: €9,95
  - Full Report: €34,95
  - AI-Coach: €20/maand
- Full Report Advies-Periode: 1 jaar (aanbevolen)
- Ziektebeelden: Chronische Vermoeidheid, Spijsverterings-Problemen, SOLK, ALK

## Bugs (April 2026)
- [x] Report toont raw JSON in plaats van opgemaakte tekst
- [x] Na rapport generatie springt pagina terug naar laadmelding i.p.v. rapport te tonen
- [x] Bestaande corrupte rapporten in productie DB verwijderen (via "Opnieuw genereren" knop)
- [x] Rapport weergave werkt niet voor bestaande rapporten met verkeerde data
- [x] Rapport generatie hangt oneindig (3+ minuten) - LLM timeout of fout zonder foutmelding aan gebruiker
- [x] regenerateLatestReport procedure mislukt op productie - fout nu direct zichtbaar + localStorage draft toegevoegd
- [x] KRITIEK: Raw JSON wordt opgeslagen in content veld - geneste JSON extractie toegevoegd + content validatie verbeterd
- [x] Rapport generatie blijft hangen - fout wordt niet getoond aan gebruiker, pagina loopt oneindig
- [x] Foutmelding direct tonen (niet na 2 min timeout) bij rapport generatie fout - timeout verlaagd naar 30s
- [x] Holistische kennisbase toevoegen aan AI prompt voor betere rapport kwaliteit - server/knowledge/holisticBase.ts
- [x] E-mail/notificatie naar eigenaar wanneer rapport klaar is - notifyOwner() toegevoegd
- [x] Anamnese vragen verbeteren per aandoening - conditie-specifieke vragen toegevoegd per ziektebeeld
- [x] KRITIEK: Raw JSON nog steeds opgeslagen in content veld - twee aparte LLM aanroepen (tekst + structuur) + corruptie detectie in frontend
- [x] KRITIEK: Tweede LLM aanroep (structuurdata) slaat nog steeds JSON op in content - DEFINITIEF OPGELOST: structuurdata is nu hardcoded per ziektebeeld, ALLEEN plain text LLM aanroep voor content, JSON detectie als veiligheidsnot
- [ ] KRITIEK: json() kolommen in MySQL worden samengevoegd met content veld - verwijder json() kolommen en gebruik text() kolommen

## Nieuwe Taken (April 2026 - Ronde 2)
- [x] Disclaimer footer toevoegen aan homepage (klein lettertype, dynamisch jaartal)
- [x] AI-coach sectie volledig verwijderen van website (rapport pagina + navigatie)
- [x] Stripe betaling bugfix: €34,95 betaallink moet ALTIJD werken (bedrag nu server-side, ai_coach verwijderd)
- [x] Volledig rapport verbeteren: 12-maanden plan, correlaties, uitleg waarom adviezen belangrijk zijn
- [x] AI prompt verbeteren met holistische correlaties (stress→oxidatieve stress, darm-brein as, etc.)
- [x] Call-to-action toevoegen aan volledig rapport (contact opnemen voor follow-up)
- [x] Email bevestiging na rapport generatie
- [x] Admin dashboard
- [x] PDF download van rapport

## Nieuwe Taken (April 2026 - Ronde 3)
- [x] AI brein upgrade: multi-layer analyse (biologisch, leefstijl, zenuwstelsel, gedrag, geschiedenis)
- [x] AI correlatie engine: ALS DIT + DIT → DAN MOGELIJK DAT (stress+darm, vermoeidheid+brain fog, hormonen)
- [x] AI validatiesysteem: verplichte vragen over bloedwaarden, eerdere pogingen, wat niet werkte
- [x] AI rapport structuur: Herkenning → Logica → Gevolgen → Oplossing → 12-maanden plan
- [x] AI gedragssturing: motiveren via logica, niet via "je moet dit doen"
- [x] Admin dashboard: overzicht alle rapporten, betalingen, anamneses
- [x] Admin: email notificatie bij nieuw rapport (naar eigenaar info@holistischadviseur.nl)
- [x] Email bevestiging aan klant na rapport generatie
- [x] Sleep & Daily Reboot Protocol integreren in rapporten

## Nieuwe Taken (April 2026 - Ronde 4)
- [x] E-mail debug: info@holistischadviseur.nl ontvangt geen rapporten - fix Resend sender/domain (onboarding@resend.dev werkt)
- [x] Protocollen en aanbevelingen zijn leeg in rapporten - fix AI response parsing (JSON.stringify toegevoegd)
- [x] PDF download toevoegen aan rapport pagina (server-side generatie met styled HTML)

## Nieuwe Taken (April 2026 - Ronde 5)
- [x] Automatische e-mail met PDF bijlage naar klant na inzicht rapport generatie
- [x] Automatische e-mail met PDF bijlage naar info@holistischadviseur.nl na inzicht rapport
- [x] Automatische e-mail met PDF bijlage naar klant na volledig rapport generatie
- [x] Automatische e-mail met PDF bijlage naar info@holistischadviseur.nl na volledig rapport

## Input Normalization Layer (April 2026)
- [x] input_normalization.ts module bouwen: synoniemen mapping, symptoom clustering, confidence scoring

## AI Kennisbrein Bouwen (April 2026)
- [x] YouTube kanalen analyseren: Dr. Berg, Stop Chasing Pain, Barbara O'Neill
- [x] Kennisbank structuur bouwen: /knowledge/channels/ + /topics/ + /correlations/ + /protocols/
- [x] Correlatie matrix bouwen (25 verbanden in correlation_matrix.json)
- [x] Protocol bestanden: BIG6 lymfatisch reset, 4R darmherstel, bijnieruitputting herstel
- [x] Kennisbank integreren in AI rapport systeem (holisticBase.ts + anamnesis.ts + reports.ts)

## Nieuwe Taken (April 2026 - Ronde 6)
- [ ] Leefstijlsectie toevoegen aan rapport: slaapadvies (circadiaans ritme, slaaphygiëne, stress-slaap connectie)
- [ ] Leefstijlsectie toevoegen aan rapport: bewegingsadvies (type, frequentie, intensiteit per aandoening)
- [ ] RapportPage.tsx updaten: nieuwe sectie weergeven met slaap 🌙 en beweging 🏃 kaarten
- [ ] AI prompts updaten: slaap + beweging als verplichte secties in zowel inzicht als volledig rapport

## Input Normalization Koppeling (April 2026)
- [x] normalizeInput() koppelen aan anamnesis.ts: verplicht vóór correlatie analyse
- [x] extractStandardSymptoms() doorgeven aan AI prompt als genormaliseerde symptomenlijst
- [x] clusterScores doorgeven aan AI prompt zodat AI weet welke clusters actief zijn


## Stabilization Phase (April 2026 - Ronde 7)
- [x] Fix /mijn-rapporten route 404 error
- [x] Add medical disclaimer to all reports: "Dit is geen medisch advies. Dit is een holistische analyse ter ondersteuning."
- [x] Create test cases for edge cases: single symptom, contradictory symptoms, low confidence inputs


## Stabilization Verification (April 2026 - Ronde 8)
- [x] Verify disclaimer is visible as first paragraph in report UI
- [x] Test full flow: anamnesis → normalization → report generation → disclaimer display
- [x] Test edge case: single symptom input generates report with disclaimer
- [x] Test edge case: contradictory symptoms handled correctly
- [x] Test edge case: low confidence inputs filtered properly
- [x] Verify /mijn-rapporten route works (no 404)
- [x] Check PDF export includes disclaimer
- [x] Verify email delivery includes disclaimer


## PDF Export Bug Fix (April 2026 - Ronde 9)
- [x] Fix .map() error in pdfGenerator.ts: added type checking for items array
- [x] Fix .map() error in reports.ts: added type checking for items array
- [x] Fix React hooks error in RapportPage: moved downloadPdfMutation to top-level
- [x] Disclaimer already present in PDF HTML template
- [x] Install Puppeteer and Chrome for PDF generation
- [x] PDF generation, upload, and download working end-to-end
- [x] PDF renders correctly in browser with 4 pages
- [x] Disclaimer visible in PDF output
- [x] COMPLETE: PDF export fully working

## PDF Generation Logging (April 2026 - Ronde 10)
- [x] Add logging to pdfGeneratorV2.ts: HTML size, PDF size, generation time
- [x] Add logging to reports.ts: start, generation time, S3 upload time, total time
- [x] Add error logging with timestamps and error messages
- [x] Test logging output - verified in devserver.log
- [x] COMPLETE: PDF logging fully implemented


## Bug Fixes (April 2026 - Ronde 11)
- [x] Fix admin access: ensure owner account has admin role (set-admin.mjs script)
- [x] Fix RBAC middleware: admin users can access /admin (already working)
- [x] Fix email flow: send full report PDF to admin email ALWAYS (email.ts modified)
- [x] Verify both fixes work end-to-end


## Rapport Generation Timeout Debug (April 2026 - Ronde 12)
- [x] Add detailed logging to rapport generation flow
- [x] Check AI/LLM response time and timeout settings
- [x] Check PDF generation and S3 upload timing
- [x] Check frontend API request timeout
- [x] Apply minimal fixes to resolve timeout (increased from 30s to 60s)
- [x] Test rapport generation and verify it works

## Admin Access Debug & Fix (April 2026 - Ronde 13)
- [x] Add debug logging to auth.me endpoint
- [x] Add debug logging to AdminDashboard component
- [x] Verify role is correctly passed from backend to frontend
- [x] Confirm admin access works - dashboard loads without "Geen toegang" error
- [x] COMPLETE: Admin access fully working with role=admin


## Rapport Generation Timeout Fix (April 2026 - Ronde 14)
- [x] Identify root cause: WeasyPrint Python tool crashing with "SRE module mismatch"
- [x] Replace WeasyPrint with Puppeteer for PDF generation (2.5s vs crash)
- [x] Add comprehensive logging to backend: every step with timing
- [x] Fix frontend timeout logic: remove hardcoded 60s timeout that caused false errors
- [x] Implement aggressive polling (2-3s intervals) during regeneration
- [x] Ensure refetch triggers immediately after mutation success
- [x] Remove waitTimeout state that was causing "timeout" error messages
- [x] Test end-to-end: rapport generates in ~16s and displays immediately
- [x] Verify no false error messages when backend is successful
- [x] COMPLETE: Rapport generation working perfectly - no more timeout errors


## Admin Rapport Viewing Fix (April 2026 - Ronde 15)
- [x] Identify root cause: "Bekijk" button navigated to /rapport without reportId
- [x] Add getReportAdmin backend endpoint for admin-only access to any report
- [x] Update AdminDashboard "Bekijk" button to pass ?id=X query parameter
- [x] Rewrite RapportPage to support both admin and user views
- [x] Admin view uses getReportAdmin endpoint (no userId restriction)
- [x] User view uses getReports endpoint (existing behavior)
- [x] Test admin viewing specific reports - works perfectly
- [x] Verify no errors or timeouts when opening reports
- [x] COMPLETE: Admin can view any rapport directly from dashboard


## Report Type Mismatch Issue (April 2026 - Ronde 16)
- [ ] Analyze how report type is determined and stored
- [ ] Check if "volledig" type is correctly saved in database
- [ ] Verify backend returns full content for "volledig" reports
- [ ] Check frontend logic for displaying based on report type
- [ ] Add logging to track report type throughout flow
- [ ] Fix: Ensure "volledig" reports show complete content, not preview
- [ ] Test: Open "volledig" rapport and verify full content displays


## Rapport Type Mismatch Fix (April 2026 - Ronde 15)
- [x] Backend: Added isPaid flag to getUserReports() function
- [x] Backend: Query payments table to determine if user paid for each report
- [x] Frontend: Updated isFullReport logic to check isPaid flag instead of just reportType
- [x] Frontend: Admin view shows full content regardless of payment status
- [x] Content restrictions: Preview shows 20% content (summary + 2/3 insights only)
- [x] Content restrictions: Full shows 100% content (all sections, protocols, references)
- [x] Admin view: Shows complete report without paywall or "Koop" button
- [x] Verified: User preview correctly shows limited content with CTA
- [x] Verified: Admin view correctly shows full content without restrictions
