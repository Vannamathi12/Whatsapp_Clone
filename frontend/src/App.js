import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './components/Login';
import API_BASE_URL from './config';
import Register from './components/Register';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import './App.css';

function AppRoutes({
  currentUser,
  setCurrentUser,
  selectedChat,
  setSelectedChat,
  unreadCounts,
  setUnreadCounts,
  onlineUsers,
  setOnlineUsers,
  lastSeenMap,
  setLastSeenMap,
  latestMessages,
  setLatestMessages,
  hiddenChatIds,
  setHiddenChatsByUser,
}) {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const [typingBySender, setTypingBySender] = useState({});

  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const selectedChatId = String(selectedChat?._id || selectedChat?.id || '');
  const hiddenChatIdSet = useMemo(
    () => new Set((hiddenChatIds || []).map((id) => String(id))),
    [hiddenChatIds],
  );

  const handlePresenceUpdate = useCallback((payload) => {
    const nextOnlineUsersRaw = Array.isArray(payload) ? payload : payload?.onlineUsers || [];
    const nextLastSeenMap = Array.isArray(payload) ? {} : payload?.lastSeen || {};
    const nextOnlineUsers = nextOnlineUsersRaw.map((userId) => String(userId));

    setOnlineUsers(nextOnlineUsers);
    setLastSeenMap(nextLastSeenMap);
  }, [setOnlineUsers, setLastSeenMap]);

  const handleIncomingMessage = useCallback((message) => {
    const senderId = typeof message.sender === 'object' ? message.sender?._id : message.sender;

    if (!senderId) {
      return;
    }

    setLatestMessages((prev) => ({
      ...prev,
      [senderId]: message,
    }));

    if (selectedChat?._id === senderId) {
      return;
    }

    setUnreadCounts((prev) => ({
      ...prev,
      [senderId]: (prev[senderId] || 0) + 1,
    }));
  }, [selectedChat, setLatestMessages, setUnreadCounts]);

  const handleConversationActivity = useCallback((otherUserId, message) => {
    if (!otherUserId || !message) {
      return;
    }

    setLatestMessages((prev) => ({
      ...prev,
      [otherUserId]: message,
    }));
  }, [setLatestMessages]);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      typingTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!socketRef.current || !currentUserId) {
      return;
    }

    const handlePresenceEvent = (payload) => {
      handlePresenceUpdate(payload);
    };

    socketRef.current.on('presence:update', handlePresenceEvent);

    socketRef.current.emit('join', currentUserId);

    return () => {
      socketRef.current?.off('presence:update', handlePresenceEvent);
    };
  }, [currentUserId, handlePresenceUpdate]);

  useEffect(() => {
    if (!socketRef.current || !currentUserId) {
      return;
    }

    const clearTypingForSender = (fromId) => {
      setTypingBySender((prev) => {
        if (!prev[fromId]) {
          return prev;
        }

        const next = { ...prev };
        delete next[fromId];
        return next;
      });
    };

    const handleTyping = (data) => {
      const fromId = String(data?.from || '');
      const toId = String(data?.to || '');

      if (!fromId || fromId === currentUserId) {
        return;
      }

      if (toId && toId !== currentUserId) {
        return;
      }

      setTypingBySender((prev) => ({
        ...prev,
        [fromId]: data?.username || 'User',
      }));

      if (typingTimeoutsRef.current[fromId]) {
        clearTimeout(typingTimeoutsRef.current[fromId]);
      }

      typingTimeoutsRef.current[fromId] = setTimeout(() => {
        clearTypingForSender(fromId);
      }, 2500);
    };

    const handleStopTyping = (data) => {
      const fromId = String(data?.from || '');
      const toId = String(data?.to || '');

      if (!fromId) {
        return;
      }

      if (toId && toId !== currentUserId) {
        return;
      }

      if (typingTimeoutsRef.current[fromId]) {
        clearTimeout(typingTimeoutsRef.current[fromId]);
        delete typingTimeoutsRef.current[fromId];
      }

      clearTypingForSender(fromId);
    };

    socketRef.current.on('typing', handleTyping);
    socketRef.current.on('stopTyping', handleStopTyping);

    return () => {
      socketRef.current?.off('typing', handleTyping);
      socketRef.current?.off('stopTyping', handleStopTyping);
    };
  }, [currentUserId]);

  const activeTypingUser = selectedChatId ? typingBySender[selectedChatId] : '';

  useEffect(() => {
    if (!currentUserId) {
      setUnreadCounts({});
      return;
    }

    const fetchUnreadCounts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/messages/unread/${currentUserId}`);
        setUnreadCounts(response.data?.unreadBySender || {});
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };

    fetchUnreadCounts();
  }, [currentUserId, setUnreadCounts]);

  const handleSelectChat = useCallback(async (user) => {
    if (hiddenChatIdSet.has(String(user?._id || user?.id || ''))) {
      return;
    }

    setSelectedChat(user);
    setUnreadCounts((prev) => ({ ...prev, [user._id]: 0 }));

    if (!currentUserId || !user?._id) {
      return;
    }

    try {
      await axios.patch(`${API_BASE_URL}/api/messages/read`, {
        receiverId: currentUserId,
        senderId: user._id,
      });
    } catch (error) {
      console.error('Failed to sync read status:', error);
    }
  }, [currentUserId, hiddenChatIdSet, setSelectedChat, setUnreadCounts]);

  useEffect(() => {
    if (selectedChatId && hiddenChatIdSet.has(selectedChatId)) {
      setSelectedChat(null);
    }
  }, [hiddenChatIdSet, selectedChatId, setSelectedChat]);

  const handleDeleteChat = useCallback(async (user) => {
    const targetUserId = String(user?._id || user?.id || '');

    if (!currentUserId || !targetUserId) {
      return;
    }

    // Optimistic UI: hide the chat immediately even if backend sync is delayed/fails.
    setHiddenChatsByUser((prev) => {
      const prevForUser = Array.isArray(prev?.[currentUserId]) ? prev[currentUserId] : [];

      if (prevForUser.includes(targetUserId)) {
        return prev;
      }

      return {
        ...prev,
        [currentUserId]: [...prevForUser, targetUserId],
      };
    });

    if (selectedChatId === targetUserId) {
      setSelectedChat(null);
    }

    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[targetUserId];
      return next;
    });

    setLatestMessages((prev) => {
      const next = { ...prev };
      delete next[targetUserId];
      return next;
    });

    try {
      await axios.delete(`${API_BASE_URL}/api/messages/conversation/${targetUserId}`, {
        params: { currentUserId },
        data: { currentUserId },
      });
    } catch (error) {
      try {
        // Some environments/proxies reject DELETE semantics; fallback to POST route.
        await axios.post(`${API_BASE_URL}/api/messages/conversation/${targetUserId}/delete`, {
          currentUserId,
        });
      } catch (fallbackError) {
        console.error('Delete chat backend sync failed:', fallbackError?.response?.data || fallbackError.message);
      }
    }
  }, [currentUserId, selectedChatId, setHiddenChatsByUser, setLatestMessages, setSelectedChat, setUnreadCounts]);

  const handleLogout = () => {
    if (socketRef.current && currentUserId) {
      socketRef.current.emit('leave');
    }

    setCurrentUser(null);
    setSelectedChat(null);
    setUnreadCounts({});
    setOnlineUsers([]);
    setLastSeenMap({});
    setLatestMessages({});
    navigate('/login');
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              onLogin={(user) => {
                setCurrentUser(user);
                navigate('/');
              }}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          currentUser ? (
            <Navigate to="/" replace />
          ) : (
            <Register
              onRegister={(user) => {
                setCurrentUser(user);
                navigate('/');
              }}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          currentUser ? (
            <div className="app-shell">
              <ChatList
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                currentUser={currentUser}
                onLogout={handleLogout}
                selectedChat={selectedChat}
                unreadCounts={unreadCounts}
                onlineUsers={onlineUsers}
                lastSeenMap={lastSeenMap}
                latestMessages={latestMessages}
                hiddenChatIds={hiddenChatIds}
              />
              <ChatWindow
                socket={socketRef.current}
                selectedChat={selectedChat}
                currentUser={currentUser}
                activeTypingUser={activeTypingUser}
                onIncomingMessage={handleIncomingMessage}
                onConversationActivity={handleConversationActivity}
                onlineUsers={onlineUsers}
                lastSeenMap={lastSeenMap}
              />
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = localStorage.getItem('currentUser');

    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [selectedChat, setSelectedChat] = useState(() => {
    const storedChat = localStorage.getItem('selectedChat');

    return storedChat ? JSON.parse(storedChat) : null;
  });
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [latestMessages, setLatestMessages] = useState({});
  const [hiddenChatsByUser, setHiddenChatsByUser] = useState(() => {
    const stored = localStorage.getItem('hiddenChatsByUser');

    return stored ? JSON.parse(stored) : {};
  });

  const appCurrentUserId = String(currentUser?.id || currentUser?._id || '');
  const hiddenChatIds = appCurrentUserId ? (hiddenChatsByUser?.[appCurrentUserId] || []) : [];

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('selectedChat');
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedChat) {
      localStorage.setItem('selectedChat', JSON.stringify(selectedChat));
    } else {
      localStorage.removeItem('selectedChat');
    }
  }, [selectedChat]);

  useEffect(() => {
    localStorage.setItem('hiddenChatsByUser', JSON.stringify(hiddenChatsByUser));
  }, [hiddenChatsByUser]);

  return (
    <Router>
      <AppRoutes
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        unreadCounts={unreadCounts}
        setUnreadCounts={setUnreadCounts}
        onlineUsers={onlineUsers}
        setOnlineUsers={setOnlineUsers}
        lastSeenMap={lastSeenMap}
        setLastSeenMap={setLastSeenMap}
        latestMessages={latestMessages}
        setLatestMessages={setLatestMessages}
        hiddenChatIds={hiddenChatIds}
        setHiddenChatsByUser={setHiddenChatsByUser}
      />
    </Router>
  );
}

export default App;
