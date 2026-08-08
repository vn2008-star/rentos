# RentOS — Firebase Setup

RentOS deploys to **Firebase Hosting with the web-frameworks backend**, the same
way the DHS app does. There is no Vercel step.

Until credentials exist the app runs in **demo mode** — Firebase is never
contacted, the login page shows Manager / Owner / Tenant buttons, and every page
reads from `src/lib/mock-data.ts`. Demo mode disables itself automatically as
soon as `NEXT_PUBLIC_FIREBASE_API_KEY` is set.

## 1. Authenticate

```bash
firebase login
```

## 2. Confirm the project exists

`.firebaserc` points at `rentos-pm-app`.

```bash
firebase projects:list
```

If it isn't there, either create it or repoint `.firebaserc`:

```bash
firebase projects:create rentos-pm-app
firebase use rentos-pm-app
```

## 3. Register a web app and capture its config

```bash
firebase apps:create web RentOS
firebase apps:sdkconfig web
```

Copy the values into `.env.local` (see `.env.example` for the full list):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=rentos-pm-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=rentos-pm-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=rentos-pm-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 4. Enable the backing services

In the Firebase Console, turn on:

- **Authentication** → Email/Password and Google sign-in
- **Firestore Database** → production mode, location `nam5`
- **Storage** → default bucket

## 5. Deploy rules first, then the app

```bash
firebase deploy --only firestore:rules,storage
firebase deploy --only hosting
```

The first `hosting` deploy detects Next.js, builds it, and provisions a Cloud
Run backend in `us-central1` (configured under `hosting.frameworksBackend` in
`firebase.json`).

## 6. Server-side secrets

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must **not** be committed and
must **not** carry a `NEXT_PUBLIC_` prefix — that would inline them into the
browser bundle. Store them in Secret Manager and grant the backend access:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

## Contractor accounts

Contractors sign in like anyone else, but their user document must carry a
`vendorId` pointing at their `vendors/{id}` record:

```
users/{uid} = { role: "contractor", orgId: "...", vendorId: "vendor-1", ... }
```

`firestore.rules` uses that field to let a contractor read and update only the
work orders assigned to them. Without it they can reach no work orders at all.
A contractor may not reassign a work order or move it between orgs — the rules
pin `vendorId` and `orgId` on update.

## Known gaps

- **Contractors can still over-read other org data.** A contractor's profile
  carries the org's `orgId` so the work-order page can resolve the property,
  unit and tenant contact it needs. That same `orgId` satisfies `belongsToOrg`
  on every other collection. Narrowing this needs server-side mediation, which
  was deliberately deferred — see the architecture note below.
- **Client-side data layer.** All Firestore access happens in the browser, so
  `firestore.rules` is the only enforcement boundary. The DHS app instead routes
  everything through the Admin SDK server-side. Revisit if the over-read above
  becomes a real concern.
- **No seed data.** With a live but empty Firestore, `useFirestoreCollection`
  falls back to mock data whenever a collection returns zero documents.
