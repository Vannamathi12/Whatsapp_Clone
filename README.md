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

## Environment Variables Reference

### Backend (`backend/.env`)
- `MONGODB_URI`
   - Required: Yes
   - Example: `mongodb://localhost:27017/whatsapp_clone`
   - Description: MongoDB connection string used by Mongoose at backend startup.

- `PORT`
   - Required: Recommended
   - Example: `5000`
   - Description: Express server port. Falls back to `5000` if not set.

- `JWT_SECRET`
   - Required: Recommended for secure deployments
   - Example: `your_secret_key_here`
   - Description: Secret used for token-based authentication flows.

- `MESSAGE_RESTORE_WINDOW_MS`
   - Required: Optional
   - Example: `5000`
   - Description: Undo restore window for deleted messages in milliseconds.
   - Runtime bounds: clamped to `1000`-`60000` ms.

### Frontend (`frontend/.env`)
- `REACT_APP_API_URL`
   - Required: Yes for deployment
   - Example (local): `http://localhost:5000`
   - Example (hosted): `https://your-backend.onrender.com`
   - Description: Base URL for frontend REST calls and Socket.IO connection.

## Database Setup Details

### Database Engine
- MongoDB with Mongoose ODM.

### Collections Used
- `users`
   - `username` (String, required, unique)
   - `email` (String, required, unique)
   - `password` (String, required)
   - `createdAt`, `updatedAt` (timestamps)

- `messages`
   - `sender` (ObjectId -> User, required)
   - `receiver` (ObjectId -> User, required)
   - `content` (String, required)
   - `status` (`sent`, `delivered`, `read`)
   - `timestamp` (Date)
   - `isDeleted` (Boolean)
   - `deletedAt` (Date or null)

### Local MongoDB Setup
1. Install and run MongoDB locally.
2. Create `backend/.env` with:
    - `MONGODB_URI=mongodb://localhost:27017/whatsapp_clone`
    - `PORT=5000`
    - `JWT_SECRET=<secure value>`
    - `MESSAGE_RESTORE_WINDOW_MS=5000`
3. Start backend (`npm run dev` from project root or `backend` folder).

### MongoDB Atlas Setup (Optional)
1. Create Atlas cluster and database user.
2. Allow network access from your app IP.
3. Set `MONGODB_URI` to Atlas string:
    - `mongodb+srv://<username>:<password>@<cluster>/<db>?retryWrites=true&w=majority`
4. Restart backend service.

### Deployment Notes
- Do not commit real secrets to git.
- Set backend secrets in hosting platform env settings.
- Set frontend `REACT_APP_API_URL` to deployed backend URL.