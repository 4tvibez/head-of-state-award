# Head of State Award Registration Website

A full-stack registration website built for the Head of State Award program. The project combines a responsive public-facing experience with an authenticated administrator area for managing the event countdown and registration records.

## ✨ Features

### Public website
- Welcome and excitement screen before entering the site
- Responsive registration interface
- Official event countdown displayed to visitors
- Participant registration form
- Clear user-agreement flow
- Mobile-friendly layout and interactive UI

### Administrator area
- Private administrator login
- Protected administrator dashboard
- Administrator-controlled event date and time
- View recent registration submissions
- Registration data stored in SQLite
- Public users cannot change the official countdown

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- SQLite
- Git & GitHub
- Railway deployment

## 🎯 What I Built

This project demonstrates practical frontend and full-stack development skills, including:

- Responsive web design
- Form handling and validation
- Interactive JavaScript features
- Backend/API integration
- Authentication and protected routes
- Database storage
- Environment-variable configuration
- Deployment and troubleshooting

## 📁 Project Structure

- `public/` — public frontend files and assets
- `server.js` — Express server and backend logic
- SQLite database — registration data storage
- `package.json` — project dependencies and start script

## 🚀 Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Set:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Use strong, private values for production.

### 3. Start the application

```bash
npm start
```

Then open:

```
http://localhost:3000
```

## ☁️ Deployment

The application is designed for Node-compatible hosting such as Railway.

The production environment should provide the required environment variables through the host's secure variable/secret settings.

## 🔐 Security Notes

- Never commit administrator passwords or session secrets to GitHub.
- Never publish default credentials.
- Use HTTPS in production.
- Keep the SQLite database outside the public web directory.
- Keep administrator routes protected by authentication.

## 👨‍💻 Developer

**Desmond Nador**  
Junior Front-End Developer | Web Developer

GitHub: https://github.com/4tvibez

Portfolio: https://4tvibez.github.io/desmond-portfolio/

---

This project is part of my developer portfolio and demonstrates my experience building and deploying practical web applications using HTML, CSS, JavaScript, Node.js, Express, SQLite, GitHub, and Railway.
