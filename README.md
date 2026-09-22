# BillSheet

BillSheet is a React + Vite + Firebase billing and collection management application.

## Requirements

- Node.js 22 LTS (or a compatible current Node.js version)
- A Firebase project configured for the application

## Local setup

1. Clone the repository.
2. Run `npm install`.
3. Create `.env.local` from `.env.example` and fill in the Firebase web-app configuration values.
4. Run `npm run dev`.
5. For a production build, run `npm run build`.

## Vercel deployment

Set these environment variables in the Vercel project settings:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Vercel will use `npm run build` and publish the generated `dist` directory.
The included `vercel.json` keeps the React Router routes working on refresh/direct navigation.

## Firebase configuration

The repository keeps the Firebase deployment files used by the current application:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `functions/`

Deploy Firebase resources separately with the Firebase CLI when required.
Do not commit secret `.env` files.
