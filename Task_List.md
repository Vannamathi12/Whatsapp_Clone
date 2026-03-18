# WhatsApp Web Clone Development Task List

This task list outlines the detailed steps for developing the full-stack WhatsApp Web clone based on the requirements document. Tasks are organized by phase, with estimated time and dependencies.

## Phase 1: Project Setup and Environment Configuration (1-2 days)

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

- [ ] Build UI layout:
  - [ ] Create two-panel layout: Sidebar (chat list) and Main (chat window)
  - [ ] Implement responsive design with CSS/Tailwind
- [ ] Implement user authentication UI:
  - [ ] Create login/signup forms
  - [ ] Add form validation and error handling
  - [ ] Store user session in localStorage or React Context
- [ ] Build chat interface:
  - [ ] Chat list component: Display users/chats, highlight active chat
  - [ ] Chat window: Display message history, input field, send button
  - [ ] Message components: Distinct styling for sent (right) vs received (left) messages
  - [ ] Auto-scroll to latest message on load/send
- [ ] Integrate API calls:
  - [ ] Use Axios for fetching users, sending/receiving messages
  - [ ] Handle loading states and API errors
- [ ] Add real-time updates:
  - [ ] Set up Socket.IO client in React
  - [ ] Listen for 'newMessage' and update chat window instantly
  - [ ] Prevent duplicate messages on refresh
- [ ] Implement routing:
  - [ ] Use React Router for navigating between chats
  - [ ] Protect routes with authentication checks

## Phase 4: Integration and Real-Time Features (2-3 days)

- [ ] Connect frontend to backend:
  - [ ] Configure Axios base URL to backend server
  - [ ] Enable CORS in backend for frontend origin
- [ ] End-to-end testing:
  - [ ] Simulate two users: Register/login, send messages
  - [ ] Verify real-time updates across browser tabs/windows
  - [ ] Test persistence: Refresh page, messages remain
  - [ ] Check message ordering and timestamps
- [ ] Handle edge cases:
  - [ ] Empty message handling
  - [ ] Non-existent user/chat scenarios
  - [ ] Network errors and offline states

## Phase 5: Testing, Debugging, and Documentation (2-3 days)

- [ ] Write unit tests:
  - [ ] Backend: Test API endpoints with Jest/Supertest
  - [ ] Frontend: Test React components with Jest/React Testing Library
- [ ] Manual testing:
  - [ ] Full user flow: Signup, login, chat, logout
  - [ ] Cross-browser testing (Chrome, Firefox)
  - [ ] Mobile responsiveness
- [ ] Debug and optimize:
  - [ ] Fix any bugs in messaging or real-time
  - [ ] Optimize performance (e.g., limit message fetches)
  - [ ] Ensure clean code: Remove console.logs, add comments
- [ ] Finalize documentation:
  - [ ] Update README with detailed run instructions
  - [ ] Document API endpoints (e.g., Swagger or manual list)
  - [ ] Add troubleshooting section for common issues
  - [ ] Include screenshots or diagrams of UI

## Phase 6: Deployment and Finalization (1-2 days, optional)

- [ ] Deploy backend:
  - [ ] Choose platform (e.g., Heroku, Railway, Vercel)
  - [ ] Set up production environment variables
  - [ ] Deploy and test APIs
- [ ] Deploy frontend:
  - [ ] Build production version: `npm run build`
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