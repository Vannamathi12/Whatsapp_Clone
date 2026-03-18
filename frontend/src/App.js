import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleRegister = () => {
    // Redirect to login or show message
  };

  if (!currentUser) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onRegister={handleRegister} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  return (
    <div className="flex h-screen">
      <ChatList onSelectChat={setSelectedChat} currentUser={currentUser} />
      <ChatWindow selectedChat={selectedChat} currentUser={currentUser} />
    </div>
  );
}

export default App;