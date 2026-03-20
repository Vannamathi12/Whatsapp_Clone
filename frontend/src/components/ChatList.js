import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const ChatList = ({
  onSelectChat,
  onDeleteChat,
  onDeleteUser,
  currentUser,
  onLogout,
  selectedChat,
  unreadCounts,
  onlineUsers,
  lastSeenMap,
  latestMessages,
}) => {
  const [users, setUsers] = useState([]);
  const [actionBusyUserId, setActionBusyUserId] = useState('');
  const onlineUserIds = new Set((onlineUsers || []).map((userId) => String(userId)));

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users`);
        setUsers(res.data.filter(user => user.username !== currentUser.username));
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    if (currentUser) fetchUsers();
  }, [currentUser]);

  const formatLastSeen = (userId) => {
    const value = lastSeenMap?.[userId];

    if (!value) {
      return 'offline';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'offline';
    }

    return `last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatPreviewTimestamp = (message) => {
    const dateValue = message?.timestamp || message?.createdAt;

    if (!dateValue) {
      return '';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aTimestamp = new Date(latestMessages[a._id]?.timestamp || latestMessages[a._id]?.createdAt || 0).getTime();
    const bTimestamp = new Date(latestMessages[b._id]?.timestamp || latestMessages[b._id]?.createdAt || 0).getTime();

    if (bTimestamp !== aTimestamp) {
      return bTimestamp - aTimestamp;
    }

    return a.username.localeCompare(b.username);
  });

  const handleDeleteChat = async (event, user) => {
    event.stopPropagation();

    if (actionBusyUserId) {
      return;
    }

    const confirmed = window.confirm(`Delete all chat history with ${user.username}?`);

    if (!confirmed) {
      return;
    }

    setActionBusyUserId(String(user._id));

    try {
      await onDeleteChat?.(user);
    } catch (error) {
      alert(error?.response?.data?.error || 'Failed to delete chat history');
    } finally {
      setActionBusyUserId('');
    }
  };

  const handleDeleteUser = async (event, user) => {
    event.stopPropagation();

    if (actionBusyUserId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete user ${user.username} and all related messages? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setActionBusyUserId(String(user._id));

    try {
      await onDeleteUser?.(user);
      setUsers((prev) => prev.filter((entry) => String(entry._id) !== String(user._id)));
    } catch (error) {
      alert(error?.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionBusyUserId('');
    }
  };

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <div className="chat-row-main">
          <span className="avatar-initials own">
            {currentUser.username.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="chat-sidebar-user">Signed in as</p>
            <h3 className="chat-sidebar-name">{currentUser.username}</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="btn-logout"
        >
          Logout
        </button>
      </div>
      <h4 className="chat-list-title">Chats</h4>
      <ul className="chat-list">
        {sortedUsers.map(user => (
          <li
            key={user._id}
            onClick={() => onSelectChat(user)}
            className={`chat-item ${selectedChat?._id === user._id ? 'active' : ''}`}
          >
            <div className="chat-row">
              <div className="chat-row-main">
                <div className="avatar-wrapper">
                  <span className="avatar-initials">
                    {user.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span
                    className={`avatar-status-dot ${onlineUserIds.has(String(user._id)) ? 'online' : 'offline'}`}
                  />
                </div>
                <div>
                  <div className="chat-username">{user.username}</div>
                  <div className="chat-preview">
                    {latestMessages[user._id]?.content || 'No messages yet'}
                  </div>
                  <div className="chat-meta">
                    {onlineUserIds.has(String(user._id)) ? 'online' : formatLastSeen(user._id)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="chat-time">
                  {formatPreviewTimestamp(latestMessages[user._id])}
                </span>
                {(unreadCounts[user._id] || 0) > 0 && (
                  <span className="unread-pill">
                    {unreadCounts[user._id]}
                  </span>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => handleDeleteChat(event, user)}
                    className="chat-btn"
                    disabled={actionBusyUserId === String(user._id)}
                  >
                    Delete Chat
                  </button>
                  <button
                    type="button"
                    onClick={(event) => handleDeleteUser(event, user)}
                    className="chat-btn"
                    disabled={actionBusyUserId === String(user._id)}
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default ChatList;