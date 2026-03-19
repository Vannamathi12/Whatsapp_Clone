# WhatsApp Web Clone

A simplified full-stack clone of WhatsApp Web with core chat functionality.

## Tech Stack
- **Frontend**: React.js, React Router, Axios, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.IO
- **Database**: MongoDB (local or Atlas)

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB (local installation or Atlas account)

## Installation and Setup

### Backend Setup
1. Navigate to the backend folder:
   ```
   cd backend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   - Copy `.env` file and update values:
     - `MONGODB_URI`: Your MongoDB connection string
     - `PORT`: Server port (default 5000)
     - `JWT_SECRET`: A secret key for JWT (if implementing auth)
       - `MESSAGE_RESTORE_WINDOW_MS`: Undo restore window in milliseconds (default 5000, allowed range 1000-60000)
4. Start MongoDB locally or ensure Atlas connection.
5. Run the server:
   ```
   npm start
   ```

### Frontend Setup
1. Navigate to the frontend folder:
   ```
   cd frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```

## Usage
1. From the project root, run both apps together:
   ```
   npm run dev
   ```
   This command auto-clears stale listeners on ports 3000/5000 before starting.
2. Open http://localhost:3000 in your browser.
3. Register/login users and start chatting.

Optional commands:
```
npm run dev:raw
npm run dev:chrome
```
`dev:chrome` starts both servers and opens `http://localhost:3000` automatically when ready.

## API Endpoints
- `POST /api/users/register`: Register a new user (body: {username, email, password})
- `POST /api/users/login`: Login user (body: {username, password}) - returns user object
- `GET /api/users`: Get all users
- `POST /api/messages`: Send a message (body: {sender: userId, receiver: userId, content})
- `GET /api/messages/:chatId?sender=userId`: Get messages for a chat
- `GET /api/messages/unread/:userId`: Get unread counts grouped by sender (ignores soft-deleted messages)
- `PATCH /api/messages/read`: Mark conversation messages as read (body: {receiverId, senderId}, ignores soft-deleted messages)
- `DELETE /api/messages/:messageId`: Soft delete own message (body: {userId})
  - Returns `{ success, messageId, deletedAt, undoExpiresAt }`
- `POST /api/messages/:messageId/restore`: Restore own soft-deleted message within window (body: {userId})
  - `409`: Message is not eligible for restore
  - `410`: Restore window has expired

## Message Deletion and Undo
- Message deletion is soft-delete based (`isDeleted=true`) so message history remains consistent.
- Deleted messages are excluded from unread aggregation and mark-read updates.
- Restore is server-enforced by `MESSAGE_RESTORE_WINDOW_MS`.
- Socket events:
   - `messageDeleted` includes `undoExpiresAt` for client countdown
   - `messageRestored` updates clients in real time

## Real-Time Features
- Messages update instantly using Socket.IO.
- Events: 'sendMessage' (emit), 'receiveMessage' (listen)

## Testing
- Backend: `npm test` (Jest + Supertest)
- Frontend: `npm test` (Jest + React Testing Library)

## Troubleshooting
- Ensure MongoDB is running locally or connection string is correct.
- Check console for errors in browser/network tabs.
- For CORS issues, verify backend CORS settings.
- On Windows, if startup is flaky in PowerShell, run from Command Prompt:
   ```
   cmd /c npm run dev
   ```
- Keep the `npm run dev` terminal dedicated while the app is running. Run health checks in a separate terminal.
- Quick health checks:
   - Backend: `curl http://localhost:5000/api/users`
   - Frontend: open `http://localhost:3000`