# BillSheet

BillSheet is a React + Vite billing and collection management application backed by Firebase Authentication and Cloud Firestore.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Use the default Vite build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
3. The included `vercel.json` keeps React Router routes working on Vercel.

The production build includes the Firebase web configuration in `.env.production` so the deployed app connects to the existing Firestore project. Firebase security rules still control access to the data.

## Run locally

```bash
npm install
npm run dev
```

## Firebase

Firestore rules, indexes, Storage rules, and Firebase Functions configuration are kept in this repository for the existing Firebase project. Deploy those resources with the Firebase CLI only when you intentionally need to change the backend configuration.

The web app requires these Vercel/Vite production variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

These are Firebase Web SDK client configuration values, not server secrets. The application refuses to enter the production app when Firebase cannot initialize, rather than falling back to local/demo data.

## Data safety

The application reads users, payments, categories, settings, and related records from Firestore for the authenticated owner. No sample/demo dataset is included in this production bundle, and no automatic database reset or migration is performed by the deploy package.
