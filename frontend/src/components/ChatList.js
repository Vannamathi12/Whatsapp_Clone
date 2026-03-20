import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const ChatList = ({
  onSelectChat,
  onDeleteChat,
  currentUser,
  onLogout,
  selectedChat,
  unreadCounts,
  onlineUsers,
  lastSeenMap,
  latestMessages,
  hiddenChatIds,
}) => {
  const [users, setUsers] = useState([]);
  const [actionBusyUserId, setActionBusyUserId] = useState('');
  const [deleteCandidateUserId, setDeleteCandidateUserId] = useState('');
  const deleteActionsRef = useRef(null);
  const onlineUserIds = new Set((onlineUsers || []).map((userId) => String(userId)));

  useEffect(() => {
    if (!deleteCandidateUserId) return undefined;

    const handleOutsideClick = (event) => {
      if (deleteActionsRef.current && !deleteActionsRef.current.contains(event.target)) {
        setDeleteCandidateUserId('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [deleteCandidateUserId]);

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

  const hiddenChatIdSet = new Set((hiddenChatIds || []).map((id) => String(id)));
  const visibleUsers = sortedUsers.filter((user) => !hiddenChatIdSet.has(String(user._id)));

  const handleDeleteIntent = (event, user) => {
    event.stopPropagation();

    if (actionBusyUserId) {
      return;
    }

    const userId = String(user._id);
    setDeleteCandidateUserId((previous) => (previous === userId ? '' : userId));
  };

  const handleCancelDelete = (event) => {
    event.stopPropagation();
    setDeleteCandidateUserId('');
  };

  const handleDeleteChat = async (event, user) => {
    event.stopPropagation();

    if (actionBusyUserId) {
      return;
    }

    const userId = String(user._id);

    if (deleteCandidateUserId !== userId) {
      return;
    }

    setActionBusyUserId(userId);

    try {
      await onDeleteChat?.(user);
      setDeleteCandidateUserId('');
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.error || error?.message || 'Failed to delete chat history';
      alert(status ? `Delete failed (${status}): ${message}` : message);
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
        {visibleUsers.map(user => (
          <li
            key={user._id}
            onClick={() => onSelectChat(user)}
            className={`chat-item ${selectedChat?._id === user._id ? 'active' : ''}`}
            ref={deleteCandidateUserId === String(user._id) ? deleteActionsRef : null}
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
              <div className="chat-item-right">
                <span className="chat-time">
                  {formatPreviewTimestamp(latestMessages[user._id])}
                </span>
                {(unreadCounts[user._id] || 0) > 0 && (
                  <span className="unread-pill">
                    {unreadCounts[user._id]}
                  </span>
                )}
                <div className="chat-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(event) => handleDeleteIntent(event, user)}
                    className={`chat-btn chat-delete-trigger ${deleteCandidateUserId === String(user._id) ? 'active' : ''}`}
                    disabled={actionBusyUserId === String(user._id)}
                  >
                    {actionBusyUserId === String(user._id) ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>

            {deleteCandidateUserId === String(user._id) && (
              <div
                className="chat-delete-confirm chat-delete-confirm-inline"
                role="alert"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="chat-delete-copy">Delete this chat?</span>
                <div className="chat-delete-buttons">
                  <button
                    type="button"
                    onClick={(event) => handleDeleteChat(event, user)}
                    className="chat-btn chat-delete-confirm-btn"
                    disabled={actionBusyUserId === String(user._id)}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    className="chat-btn chat-delete-cancel-btn"
                    disabled={actionBusyUserId === String(user._id)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default ChatList;