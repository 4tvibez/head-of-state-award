# Head of State Award Registration

This project runs on Vercel with Supabase as its persistent database. It does not require Railway.

## 1. Create the Supabase database
1. Create a Supabase project.
2. Open **SQL Editor** and run the complete contents of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the **service_role** key. Keep the service-role key private.

## 2. Configure Vercel
In the Vercel project, open **Settings → Environment Variables** and add these for Production (and Preview if needed):
- `SUPABASE_URL` — your Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service_role key
- `ADMIN_USER` — your chosen administrator username
- `ADMIN_PASSWORD` — a strong, unique password (do not use the old default)
- `SESSION_SECRET` — a random secret of at least 32 characters

Redeploy after adding or changing environment variables.

## 3. Deploy
Import this GitHub repository into Vercel. Use the repository root (`./`). Vercel should detect the Node application. The `api/index.js` function serves the API and the static files in `public/`.

## 4. Test before sharing the QR code
- Open `/api/health` and confirm `configured: true`.
- Submit a test registration.
- Sign in through **Administrator** and confirm the test record appears.
- Set a test countdown and confirm it appears on the public page.
- Delete test records from Supabase only after verifying the system.

## Important privacy notes
This form collects personal details and passport photographs. Keep the Supabase service-role key only in Vercel server environment variables. Do not create public database policies or expose registration records. Use a strong admin password, restrict who can access the Vercel project, and publish an appropriate privacy/consent notice before inviting students to register.

## Local development
Run `npm install`, set the same environment variables, then run `npm start`.
