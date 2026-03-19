# WhatsApp Web Clone Development Task List

This task list outlines the detailed steps for developing the full-stack WhatsApp Web clone based on the requirements document. Tasks are organized by phase, with estimated time and dependencies.

## Phase 1: Project Setup and Environment Configuration (1-2 days)cd c:\Devlopment\Full_Stack\backend
npm run dev

- [x] Create project root directory structure: `frontend/` and `backend/` folders
- [x] Initialize Git repository and create `.gitignore` file (exclude node_modules, .env, etc.)
- [x] Set up backend Node.js project:
  - [x] Run `npm init` in `backend/` folder
  - [x] Install core dependencies: express, mongoose (for MongoDB), socket.io, bcryptjs, cors, dotenv
  - [x] Create basic server.js file with Express setup
- [x] Set up frontend React project:
  - [x] Use Create React App: `npx create-react-app frontend` or Vite for faster setup
  - [x] Install dependencies: axios, react-router-dom, socket.io-client, and a CSS framework (e.g., tailwindcss or material-ui)
  - [x] Create basic App.js and index.js files
- [x] Configure database:
  - [x] Choose MongoDB (local/Atlas) or Postgres on Neon.com
  - [x] Set up connection strings in `.env` file (e.g., MONGODB_URI, PORT)
  - [x] Test database connection in backend
- [x] Update README.md:
  - [x] Add project overview and tech stack
  - [x] Document installation steps for frontend and backend
  - [x] Include environment variables setup and database configuration

## Phase 2: Backend Development (3-5 days)

- [x] Design database schemas:
  - [x] User schema: id, username/email, password (hashed), createdAt
  - [x] Message schema: sender (user ID), receiver (user ID), content, timestamp
  - [x] Chat schema (optional): user1, user2, lastMessage, updatedAt
- [x] Implement user authentication APIs:
  - [x] POST /api/users/register: Create new user with validation
  - [x] POST /api/users/login: Authenticate user (simple username/password)
  - [x] GET /api/users: Fetch all users (for chat list)
  - [x] Add middleware for password hashing and basic auth
- [x] Implement messaging APIs:
  - [x] POST /api/messages: Send message (validate sender, receiver, content)
  - [x] GET /api/messages/:chatId: Fetch messages for a specific chat (filter by sender/receiver)
  - [x] Add error handling for invalid requests (empty messages, non-existent users)
- [x] Integrate real-time functionality:
  - [x] Set up Socket.IO server in backend
  - [x] Emit 'newMessage' event on message send
  - [x] Handle client connections and disconnections
- [x] Test backend APIs:
  - [x] Use Postman to test all endpoints
  - [x] Verify data persistence in database
  - [x] Check error responses and status codes

## Phase 3: Frontend Development (4-6 days)

- [x] Build UI layout:
  - [x] Create two-panel layout: Sidebar (chat list) and Main (chat window)
  - [x] Implement responsive design with CSS/Tailwind (professional design system in App.css, responsive at 960px)
- [x] Implement user authentication UI:
  - [x] Create login/signup forms (Login.js, Register.js with auth-* classes)
  - [x] Add form validation and error handling (backend error messages surfaced)
  - [x] Store user session in localStorage (persists across refresh)
- [x] Build chat interface:
  - [x] Chat list component: Display users/chats, highlight active chat (ChatList.js)
  - [x] Chat window: Display message history, input field, send button (ChatWindow.js)
  - [x] Message components: Distinct styling for sent (right, teal) vs received (left, white)
  - [x] Auto-scroll to latest message on load/send (messagesEndRef, scrollIntoView)
- [x] Integrate API calls:
  - [x] Use Axios for fetching users, sending/receiving messages
  - [x] Handle loading states and API errors (error notices in chat window)
- [x] Add real-time updates:
  - [x] Set up Socket.IO client in React (App.js socketRef)
  - [x] Listen for 'receiveMessage' and update chat window instantly
  - [x] Prevent duplicate messages on refresh (Set-based deduplication)
- [x] Implement routing:
  - [x] Use React Router for /login, /register, / routes
  - [x] Protect routes with authentication checks (Navigate redirect when not logged in)

## Phase 4: Integration and Real-Time Features (2-3 days)

- [x] Connect frontend to backend:
  - [x] Configure Axios base URL to backend server (http://localhost:5000)
  - [x] Enable CORS in backend for frontend origin
- [x] End-to-end testing:
  - [x] Simulate two users: Register/login, send messages (API tested via PowerShell + curl)
  - [x] Verify real-time updates across browser tabs/windows (Socket.IO events confirmed)
  - [x] Test persistence: Refresh page, messages remain (MongoDB storage verified)
  - [x] Check message ordering and timestamps (chronological fetch with pagination)
- [x] Handle edge cases:
  - [x] Empty message handling (trimmed server-side, 400 returned)
  - [x] Non-existent user/chat scenarios (404 returned)
  - [x] Network errors and offline states (error notices rendered in chat window)

## Phase 5: Testing, Debugging, and Documentation (2-3 days)

- [x] Write unit tests:
  - [x] Backend: 30 tests passing (Jest + Supertest) — user registration/login, messaging, pagination, soft-delete, restore, unread, read-receipts
  - [x] Frontend: 8 tests passing (Jest + React Testing Library) — ChatWindow Undo UX, socket events, countdown, error toasts
- [x] Manual testing:
  - [x] Full user flow: Signup, login, chat, logout
  - [x] Cross-browser testing (Chrome verified)
  - [ ] Mobile responsiveness (responsive CSS added, not manually tested on device)
- [x] Debug and optimize:
  - [x] Fix any bugs in messaging or real-time
  - [x] Optimize performance: paginated message fetch (30 per page, load-older on scroll)
  - [x] Clean code: proper error handling, no unnecessary console.logs
- [x] Finalize documentation:
  - [x] Update README with detailed run instructions
  - [x] Document all API endpoints in README
  - [x] Add troubleshooting section for common issues (Windows/PowerShell tips)
  - [ ] Include screenshots or diagrams of UI

## Phase 6: Deployment and Finalization (1-2 days, optional)

- [ ] Deploy backend:
  - [ ] Choose platform (e.g., Heroku, Railway, Render)
  - [ ] Set up production environment variables
  - [ ] Deploy and test APIs
- [ ] Deploy frontend:
  - [x] Build production version: `npm run build` (compiled successfully — 85.57 kB JS, 4.09 kB CSS)
  - [ ] Deploy to Netlify, Vercel, or similar
  - [ ] Update API URLs for production
- [ ] Final checks:
  - [ ] Test deployed app end-to-end
  - [ ] Update README with deployment links
  - [ ] Add any production-specific notes (e.g., scaling)

## General Notes
- **Dependencies**: Ensure Node.js, npm, and MongoDB/Postgres are installed locally.
- **Time Estimates**: Adjust based on experience; focus on core features first.
- **Tools**: Use VS Code for development, Git for version control.
- **AI Assistance**: Leverage AI for code generation, but review and test thoroughly.
- **Milestones**: Mark tasks complete as you go; aim for a working MVP by end of Phase 3.