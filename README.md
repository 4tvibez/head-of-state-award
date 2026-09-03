# Head of State Award Registration — Administrator Controlled

## What this includes
- Public registration website with the welcome/excitement screen.
- Public countdown that reads the official event date from the server.
- Private administrator login.
- Administrator dashboard to set the official event date/time.
- Registration records stored in SQLite.
- Administrator can view recent registrations.

## Run locally
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:
   npm install
4. Set strong environment variables before starting:
   - ADMIN_USER
   - ADMIN_PASSWORD
   - SESSION_SECRET
5. Start:
   npm start
6. Open:
   http://localhost:3000

Example (Linux/macOS):
ADMIN_USER=desmond ADMIN_PASSWORD='CHANGE_THIS_TO_A_LONG_RANDOM_PASSWORD' SESSION_SECRET='USE_A_LONG_RANDOM_SECRET' npm start

## Important security note
Do not publish the default `CHANGE-ME-NOW` password. Use HTTPS when hosting publicly. Put the site behind a reputable host/reverse proxy and keep the SQLite database outside the public web directory. The public page has no controls for changing the countdown; only authenticated admin requests can update it.

## Deploy
This is a Node/Express application. It can be deployed to a Node-compatible host. Set the environment variables in the host's secret/environment-variable settings and use `npm start` as the start command.
