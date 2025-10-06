Here’s the complete README-style package with all the elements you requested: high-level documentation, architecture diagram, API/route contracts, and a Security Rules draft — still code-free, focused on what and how at the system level.

⸻

Wedding Management Platform – README for Developers & Stakeholders

1. Project Overview

A multilingual wedding management platform for couples to manage guest lists, RSVPs, seating, tasks, budget, and vendor benchmarking, with a separate admin dashboard for managing couples and platform-wide settings.
	•	Languages: English, French, Spanish
	•	Frontend: Next.js + React + TypeScript + Tailwind
	•	Backend: Firebase (Auth, Firestore, Storage, Cloud Functions)
	•	Deployment: Vercel for both apps, Firebase for backend
	•	Notifications: MailerSend for RSVP updates; WhatsApp share links
	•	Data Ownership: Each couple has an isolated data space (tenant) enforced by Firestore Security Rules

⸻

2. Architecture Diagram

                        ┌─────────────────────────────┐
                        │           Admin App          │
                        │  Next.js (Vercel)            │
                        └─────────────┬───────────────┘
                                      │ HTTPS
                                      ▼
                        ┌─────────────────────────────┐
                        │ Firebase Authentication     │
                        │   (Admin & Couples)         │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                ┌─────────────────────────────────────────┐
                │              Firestore                  │
                │ couples/{coupleId}/...                  │
                └─────────────┬───────────────────────────┘
                              │
                              ▼
         ┌───────────────┐       ┌────────────────┐      ┌─────────────────┐
         │Client App     │       │Cloud Functions │      │Firebase Storage │
         │Next.js (Vercel│──────▶│RSVP, exports,  │◀────▶│Docs, images,    │
         │Couples+Guests │       │email, analytics│      │charts, backups  │
         └───────────────┘       └────────────────┘      └─────────────────┘

	•	Client App: includes couple dashboard + public RSVP mini-site
	•	Admin App: separate deployment for platform operators
	•	Firestore: stores all structured wedding data
	•	Cloud Functions: implements secure workflows (RSVP token validation, stats, notifications, exports)
	•	Storage: holds documents, images, and generated exports
	•	Auth: manages secure sign-in for couples and admins
	•	i18n: client-side internationalization per locale

⸻

3. Core Concepts

3.1 Multi-Tenant Model

Each couple is represented by a couples/{coupleId} document with sub-collections for all related data (guests, groups, events, seating, tasks, budget, vendors, analytics).

3.2 Theming

Global CSS variables persisted in each couple’s profile allow easy re-branding; Tailwind utilities reference these variables for consistent styling.

3.3 RSVP Access Modes

Two complementary ways for guests to respond:
	•	Tokenized link: secure per-guest or per-household link with expiry/revocation.
	•	Mini-site with group password: public wedding site where the RSVP form is gated by a group password (e.g., “Family”), restricting visible events.

3.4 Admin Capabilities

A separate admin dashboard provides:
	•	Couple management (create/suspend/support)
	•	Theme management
	•	Role assignment (admin vs couple)
	•	Optional global vendor directory
	•	Future platform-level analytics

⸻

4. API / Route Contracts (Conceptual)

4.1 Client App Routes
	•	/app/dashboard – overview for the couple
	•	/app/guests – list, filter, tag guests
	•	/app/seating – table layout editor
	•	/app/tasks – to-do manager
	•	/app/budget – forecast vs actual
	•	/app/vendors – benchmarking tables
	•	/app/settings – locale, theme, RSVP mode, currency
	•	/rsvp/[coupleSlug] – public mini-site with event info
	•	/rsvp/[coupleSlug]/form – gated RSVP form (by token or password)

4.2 Admin App Routes
	•	/admin/login
	•	/admin/couples – list, search, onboard couples
	•	/admin/couples/[coupleId] – view/manage one couple
	•	/admin/themes/[coupleId] – manage theme variables
	•	/admin/roles – assign/revoke admin
	•	/admin/vendors – manage global directory (optional)
	•	/admin/analytics – view platform usage (optional, future)

4.3 Public/Server APIs
	•	POST /api/rsvp/validate-group – validates group password, returns allowed event list
	•	POST /api/rsvp/submit – records RSVP for a guest
	•	POST /api/rsvp/generate-link – creates signed tokenized link (admin/couple only)
	•	POST /api/export – triggers JSON/CSV/PDF export for a couple
	•	POST /api/theme/update – saves CSS variable set for a couple
	•	POST /api/admin/set-role – grants/revokes admin claim
	•	GET /api/analytics/rsvp – (optional) returns aggregated RSVP stats

All routes use Firebase Authentication for couples/admins where needed.
Public RSVP endpoints validate tokens or passwords server-side.

⸻

5. Firestore Data Collections (Conceptual)

Each couple’s document acts as a tenant root with sub-collections:
	•	profile – owners, locale, currency, theme, RSVP mode
	•	events – ceremony, reception, etc.
	•	groups – name, allowed event IDs, optional password
	•	guests – personal info, tags, group affiliation, RSVP object
	•	seating – tables and seat assignments
	•	tasks – event-linked to-dos
	•	budget – planned vs actual line items
	•	vendors – service provider details and quotes
	•	rsvpLinks – active tokens for link-based RSVPs
	•	analytics – pre-computed RSVP and attendance metrics

⸻

6. Security Rules (Draft, Conceptual)
	•	Tenant Isolation: couple data accessible only by its owners or admins.
	•	Admin Privileges: checked via role: 'admin' custom claim.
	•	RSVP Link Access: limited update permissions to RSVP fields when a valid token is presented.
	•	Public Group Password Flow: validated server-side, no direct Firestore access.
	•	Storage: couple-scoped directories with strict file type/size checks.

⸻

7. Features and Methods Summary

Feature	Implementation Approach
Theming	CSS variables at root; editable in admin UI; applied across Tailwind utilities
Internationalization	i18next with module-based JSON namespaces
Guest Management	Firestore collection with tags, groups; WhatsApp share link for invitations
RSVP Handling	Two modes (tokenized link, group password mini-site); secure server validation; MailerSend email alerts
RSVP Analytics	Cloud Functions aggregate stats into analytics sub-doc
Seating Planner	React Konva for drag-and-drop tables and guests; export as image/PDF
Budget & Charts	Single-currency, tracked per item with planned vs actual; Chart.js for dashboards
Vendor Benchmarking	Comparison tables per category; optional weighting of factors
Task Management	Per-event tasks with status, due dates, optional email reminders
Admin Dashboard	Separate app; manages couples, themes, roles, (optional) vendors & analytics
Exports	Cloud Functions compile JSON/CSV/PDF, stored per couple with signed URLs
Search	Firestore query filters + client-side text filtering for typical list sizes
Notifications	MailerSend for RSVP updates; WhatsApp share links for guest invitations


⸻

8. Delivery Phases
	1.	Platform Foundation: apps, Firebase projects, Auth, theme & i18n setup
	2.	Data & Security: schema & rules, admin role pipeline
	3.	Guest Management & Groups
	4.	RSVP Mini-site & Form
	5.	Seating Planner
	6.	Budget & Charts
	7.	Vendors & Benchmarking
	8.	Tasks Module
	9.	Admin Dashboard
	10.	Exports & Final Polish

⸻

9. Notes for Developers
	•	Follow component-based architecture with Tailwind utility classes for styling.
	•	Keep Firestore queries scoped by coupleId and apply Security Rules strictly.
	•	Make RSVP mode (token or password) configurable per couple in their profile.
	•	Maintain i18n JSON files in structured namespaces for easy scaling.
	•	Use Cloud Functions for all operations requiring secure backend logic.
	•	Store generated files and media in couple-specific Storage paths.

⸻

This package acts as a reference for engineers and product stakeholders, describing the planned structure, data model, and methods to be used — ready for team onboarding and milestone-based delivery.