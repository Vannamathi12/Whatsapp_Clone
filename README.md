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
1. Start the backend server.
2. Start the frontend server.
3. Open http://localhost:3000 in your browser.
4. Register/login users and start chatting.

## API Endpoints
- `POST /api/users/register`: Register a new user
- `POST /api/users/login`: Login user
- `GET /api/users`: Get all users
- `POST /api/messages`: Send a message
- `GET /api/messages/:chatId`: Get messages for a chat

## Real-Time Features
- Messages update instantly using Socket.IO.

## Deployment
- Backend: Deploy to Heroku, Railway, or Vercel.
- Frontend: Build with `npm run build` and deploy to Netlify or Vercel.

## Troubleshooting
- Ensure MongoDB is running locally or connection string is correct.
- Check console for errors in browser/network tabs.
- For CORS issues, verify backend CORS settings.