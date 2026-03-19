import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const ChatWindow = ({
  socket,
  selectedChat,
  currentUser,
  activeTypingUser,
  onIncomingMessage,
  onConversationActivity,
  onlineUsers,
  lastSeenMap,
}) => {
  const PAGE_SIZE = 30;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState('');
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [actionMenuMessageId, setActionMenuMessageId] = useState(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [currentStickyDate, setCurrentStickyDate] = useState('');
  const [isStickyDateVisible, setIsStickyDateVisible] = useState(false);
  const [undoState, setUndoState] = useState(null);
  const [undoNowTs, setUndoNowTs] = useState(Date.now());
  const [restoreError, setRestoreError] = useState('');
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const matchRefs = useRef([]);
  const pendingScrollRestoreRef = useRef(null);
  const isPrependingRef = useRef(false);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const undoTimeoutRef = useRef(null);

  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const selectedChatId = String(selectedChat?._id || selectedChat?.id || '');
  const onlineUserIds = new Set((onlineUsers || []).map((userId) => String(userId)));

  const getUserId = (value) => String((typeof value === 'object' ? value?._id || value?.id : value) || '');

  const sendMessageStatus = useCallback((eventName, message) => {
    const senderId = getUserId(message?.sender);

    if (!socket || !message?._id || !senderId || senderId === currentUserId) {
      return;
    }

    socket.emit(eventName, {
      messageId: String(message._id),
      senderId,
      receiverId: currentUserId,
    });
  }, [socket, currentUserId]);

  const emitStopTyping = () => {
    if (!socket || !selectedChatId || !currentUserId || !isTypingRef.current) {
      return;
    }

    socket.emit('stopTyping', {
      from: currentUserId,
      to: selectedChatId,
    });
    isTypingRef.current = false;
  };

  const fetchMessagesPage = useCallback(async ({ beforeTimestamp = '' } = {}) => {
    if (!selectedChatId || !currentUserId) {
      return [];
    }

    const params = new URLSearchParams({
      sender: currentUserId,
      limit: String(PAGE_SIZE),
    });

    if (beforeTimestamp) {
      params.set('before', beforeTimestamp);
    }

    const response = await axios.get(`${API_BASE_URL}/api/messages/${selectedChatId}?${params.toString()}`);
    return Array.isArray(response.data) ? response.data : [];
  }, [selectedChatId, currentUserId]);

  useEffect(() => {
    if (selectedChatId && currentUserId) {
      const fetchMessages = async () => {
        try {
          const page = await fetchMessagesPage();
          setMessages(page);
          setOldestMessageTimestamp(page[0]?.timestamp || page[0]?.createdAt || '');
          setHasOlderMessages(page.length === PAGE_SIZE);

          // Mark messages from the selected user as read when this conversation is open.
          page.forEach((message) => {
            const senderId = getUserId(message.sender);

            if (senderId === selectedChatId && senderId !== currentUserId && message.status === 'sent') {
              sendMessageStatus('messageDelivered', message);
            }

            if (senderId === selectedChatId && senderId !== currentUserId && message.status !== 'read') {
              sendMessageStatus('messageRead', message);
            }
          });

          const latest = page[page.length - 1];
          if (latest) {
            onConversationActivity?.(selectedChatId, latest);
          }
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setOldestMessageTimestamp('');
      setHasOlderMessages(false);
    }
  }, [selectedChatId, currentUserId, onConversationActivity, sendMessageStatus, fetchMessagesPage]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!hasOlderMessages || isLoadingOlder || !oldestMessageTimestamp) {
      return;
    }

    const scrollElement = scrollContainerRef.current;
    if (scrollElement) {
      pendingScrollRestoreRef.current = {
        previousHeight: scrollElement.scrollHeight,
        previousTop: scrollElement.scrollTop,
      };
      isPrependingRef.current = true;
    }

    setIsLoadingOlder(true);

    try {
      const olderPage = await fetchMessagesPage({ beforeTimestamp: oldestMessageTimestamp });

      if (olderPage.length === 0) {
        setHasOlderMessages(false);
        return;
      }

      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => String(message._id)));
        const uniqueOlder = olderPage.filter((message) => !existingIds.has(String(message._id)));

        return [...uniqueOlder, ...prev];
      });

      setOldestMessageTimestamp(olderPage[0]?.timestamp || olderPage[0]?.createdAt || oldestMessageTimestamp);
      setHasOlderMessages(olderPage.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasOlderMessages, isLoadingOlder, oldestMessageTimestamp, fetchMessagesPage]);

  const handleMessageListScroll = useCallback((event) => {
    const scrollElement = event.currentTarget;
    const distanceFromBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    setIsStickyDateVisible(scrollElement.scrollTop > 24);

    const messageElements = Array.from(scrollElement.querySelectorAll('[data-date-label]'));
    let stickyLabel = '';

    for (let i = 0; i < messageElements.length; i += 1) {
      const element = messageElements[i];
      const thresholdTop = scrollElement.scrollTop + 8;

      if (element.offsetTop <= thresholdTop) {
        stickyLabel = element.dataset.dateLabel || stickyLabel;
      } else {
        break;
      }
    }

    if (!stickyLabel && messageElements.length > 0) {
      stickyLabel = messageElements[0].dataset.dateLabel || '';
    }

    setCurrentStickyDate(stickyLabel);

    // Show jump-to-latest button if user is more than 300px from the bottom
    setShowJumpToLatest(distanceFromBottom > 300);

    if (!hasOlderMessages || isLoadingOlder || !oldestMessageTimestamp) {
      return;
    }

    if (event.currentTarget.scrollTop <= 60) {
      handleLoadOlderMessages();
    }
  }, [hasOlderMessages, isLoadingOlder, oldestMessageTimestamp, handleLoadOlderMessages]);

  useEffect(() => {
    if (!socket || !currentUserId) {
      return;
    }

    const handleIncomingMessage = (data) => {
      const senderId = getUserId(data.sender);
      const receiverId = getUserId(data.receiver);
      const isCurrentConversation =
        (senderId === selectedChatId && receiverId === currentUserId) ||
        (senderId === currentUserId && receiverId === selectedChatId);

      if (!isCurrentConversation) {
        if (receiverId === currentUserId && senderId !== currentUserId) {
          sendMessageStatus('messageDelivered', data);
          onIncomingMessage?.(data);
        }

        return;
      }

      if (receiverId === currentUserId && senderId !== currentUserId) {
        sendMessageStatus('messageDelivered', data);
        sendMessageStatus('messageRead', data);
      }

      setMessages((prev) => {
        const exists = prev.some((message) => message._id === data._id);

        return exists ? prev : [...prev, data];
      });

      onConversationActivity?.(selectedChatId, data);
    };

    socket.on('receiveMessage', handleIncomingMessage);

    const handleMessageStatusUpdate = (data) => {
      const messageId = String(data?.messageId || '');
      const status = String(data?.status || '');

      if (!messageId || !status) {
        return;
      }

      setMessages((prev) => prev.map((message) => (
        String(message._id) === messageId ? { ...message, status } : message
      )));
    };

    socket.on('messageStatusUpdated', handleMessageStatusUpdate);

    const handleMessageDeleted = (data) => {
      const messageId = String(data?.messageId || '');
      const senderId = String(data?.senderId || '');

      if (!messageId) {
        return;
      }

      setMessages((prev) => prev.map((message) => (
        String(message._id) === messageId
          ? { ...message, isDeleted: true, deletedAt: data?.deletedAt || new Date().toISOString() }
          : message
      )));

      if (senderId === currentUserId) {
        const undoExpiresAt = String(data?.undoExpiresAt || '');
        const fallbackExpire = new Date(Date.now() + 5000).toISOString();
        setUndoState({ messageId, undoExpiresAt: undoExpiresAt || fallbackExpire });
      }
    };

    socket.on('messageDeleted', handleMessageDeleted);

    const handleMessageRestored = (data) => {
      const messageId = String(data?.messageId || '');

      if (!messageId) {
        return;
      }

      setMessages((prev) => prev.map((message) => (
        String(message._id) === messageId
          ? { ...message, isDeleted: false, deletedAt: null }
          : message
      )));

      setUndoState((prev) => {
        if (prev?.messageId === messageId) {
          return null;
        }

        return prev;
      });
    };

    socket.on('messageRestored', handleMessageRestored);

    return () => {
      socket.off('receiveMessage', handleIncomingMessage);
      socket.off('messageStatusUpdated', handleMessageStatusUpdate);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messageRestored', handleMessageRestored);
    };
  }, [socket, selectedChatId, currentUserId, onIncomingMessage, onConversationActivity, sendMessageStatus]);

  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
  }, [selectedChatId]);

  useEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (pendingScrollRestoreRef.current && scrollElement) {
      const { previousHeight, previousTop } = pendingScrollRestoreRef.current;
      const nextHeight = scrollElement.scrollHeight;
      const delta = nextHeight - previousHeight;

      scrollElement.scrollTop = previousTop + delta;
      pendingScrollRestoreRef.current = null;
      isPrependingRef.current = false;
      return;
    }

    if (!isPrependingRef.current && !searchQuery.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, selectedChatId, activeTypingUser, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isInsideActionMenu = event.target.closest('[data-action-menu="true"]');
      const isActionTrigger = event.target.closest('[data-action-trigger="true"]');

      if (!isInsideActionMenu && !isActionTrigger) {
        setActionMenuMessageId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Reset sticky date when chat changes
    setCurrentStickyDate('');
    setIsStickyDateVisible(false);
  }, [selectedChatId]);

  useEffect(() => {
    setRestoreError('');
  }, [selectedChatId]);

  useEffect(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setUndoState(null);
  }, [selectedChatId]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!undoState?.undoExpiresAt) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setUndoNowTs(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [undoState]);

  useEffect(() => {
    if (!restoreError) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setRestoreError('');
    }, 3500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [restoreError]);

  useEffect(() => {
    if (!undoState?.undoExpiresAt) {
      return;
    }

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    const expireAtMs = new Date(undoState.undoExpiresAt).getTime();
    const timeoutMs = Math.max(0, (Number.isNaN(expireAtMs) ? (Date.now() + 5000) : expireAtMs) - Date.now());

    undoTimeoutRef.current = setTimeout(() => {
      setUndoState(null);
      undoTimeoutRef.current = null;
    }, timeoutMs);

    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, [undoState]);

  useEffect(() => {
    const scrollElement = scrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const messageElements = Array.from(scrollElement.querySelectorAll('[data-date-label]'));

    if (messageElements.length === 0) {
      setCurrentStickyDate('');
      return;
    }

    const thresholdTop = scrollElement.scrollTop + 8;
    let stickyLabel = messageElements[0].dataset.dateLabel || '';

    for (let i = 0; i < messageElements.length; i += 1) {
      const element = messageElements[i];

      if (element.offsetTop <= thresholdTop) {
        stickyLabel = element.dataset.dateLabel || stickyLabel;
      } else {
        break;
      }
    }

    setCurrentStickyDate(stickyLabel);
    setIsStickyDateVisible(scrollElement.scrollTop > 24);
  }, [messages, searchQuery, selectedChatId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId || !selectedChatId) return;

    const messageData = {
      sender: currentUserId,
      receiver: selectedChatId,
      content: newMessage,
    };
    try {
      const res = await axios.post(`${API_BASE_URL}/api/messages`, messageData);
      setMessages((prev) => {
        const exists = prev.some((message) => message._id === res.data._id);

        return exists ? prev : [...prev, res.data];
      });
      onConversationActivity?.(selectedChatId, res.data);
      setNewMessage('');
      emitStopTyping();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setNewMessage(value);

    if (!socket || !selectedChatId || !currentUserId) {
      return;
    }

    if (value.trim()) {
      socket.emit('typing', {
        from: currentUserId,
        to: selectedChatId,
        username: currentUser.username,
      });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!value.trim()) {
      emitStopTyping();
      return;
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 2000);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content).then(() => {
      setActionMenuMessageId(null);
    }).catch((err) => {
      console.error('Failed to copy:', err);
    });
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/messages/${messageId}`, {
        data: { userId: currentUserId },
      });

      setRestoreError('');

      setMessages((prev) => prev.map((message) => (
        message._id === messageId
          ? { ...message, isDeleted: true, deletedAt: new Date().toISOString() }
          : message
      )));

      const undoExpiresAt = String(response?.data?.undoExpiresAt || '');
      const fallbackExpireMs = Date.now() + 5000;
      const expireAtMs = undoExpiresAt ? new Date(undoExpiresAt).getTime() : fallbackExpireMs;
      const safeExpireAtMs = Number.isNaN(expireAtMs) ? fallbackExpireMs : expireAtMs;

      setUndoState({
        messageId,
        undoExpiresAt: new Date(safeExpireAtMs).toISOString(),
      });
      setActionMenuMessageId(null);
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoState?.messageId) {
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/messages/${undoState.messageId}/restore`, {
        userId: currentUserId,
      });

      setMessages((prev) => prev.map((message) => (
        message._id === undoState.messageId
          ? { ...message, isDeleted: false, deletedAt: null }
          : message
      )));

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }

      setRestoreError('');
      setUndoState(null);
    } catch (err) {
      const statusCode = Number(err?.response?.status || 0);

      if (statusCode === 410) {
        setRestoreError('Undo expired. Message can no longer be restored.');
      } else if (statusCode === 409) {
        setRestoreError('This message is not available for restore.');
      } else {
        setRestoreError('Could not restore message. Please try again.');
      }

      console.error('Error restoring message:', err);
    }
  };

  const handleJumpToLatest = () => {
    setSearchQuery('');
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const isCurrentUserMessage = (message) => {
    const senderId = getUserId(message.sender);

    return senderId === currentUserId;
  };

  const formatTimestamp = (message) => {
    const dateValue = message.timestamp || message.createdAt;

    if (!dateValue) {
      return '';
    }

    const date = new Date(dateValue);

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toDateKey = (value) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const formatDateDivider = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const dividerKey = toDateKey(date);
    const yesterdayKey = toDateKey(yesterday);

    if (dividerKey === todayKey) {
      return 'Today';
    }

    if (dividerKey === yesterdayKey) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusMeta = (message) => {
    if (!isCurrentUserMessage(message) || message.isDeleted) {
      return null;
    }

    const status = String(message.status || 'sent');

    if (status === 'read') {
      return { ticks: 2, className: 'text-blue-500', ariaLabel: 'read' };
    }

    if (status === 'delivered') {
      return { ticks: 2, className: 'text-gray-500', ariaLabel: 'delivered' };
    }

    return { ticks: 1, className: 'text-gray-500', ariaLabel: 'sent' };
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const undoRemainingSeconds = undoState?.undoExpiresAt
    ? Math.max(0, Math.ceil((new Date(undoState.undoExpiresAt).getTime() - undoNowTs) / 1000))
    : 0;

  const visibleMessages = normalizedSearchQuery
    ? messages.filter((message) => !message.isDeleted && String(message.content || '').toLowerCase().includes(normalizedSearchQuery))
    : messages;

  useEffect(() => {
    matchRefs.current = [];

    if (!normalizedSearchQuery || visibleMessages.length === 0) {
      setActiveMatchIndex(-1);
      return;
    }

    setActiveMatchIndex(0);
  }, [normalizedSearchQuery, visibleMessages.length]);

  useEffect(() => {
    if (activeMatchIndex < 0) {
      return;
    }

    const activeElement = matchRefs.current[activeMatchIndex];

    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMatchIndex]);

  const goToNextMatch = () => {
    if (visibleMessages.length === 0) {
      return;
    }

    setActiveMatchIndex((prev) => (prev + 1) % visibleMessages.length);
  };

  const goToPreviousMatch = () => {
    if (visibleMessages.length === 0) {
      return;
    }

    setActiveMatchIndex((prev) => {
      if (prev <= 0) {
        return visibleMessages.length - 1;
      }

      return prev - 1;
    });
  };

  const renderMessageContent = (content, isOwnMessage) => {
    const text = String(content || '');

    if (!normalizedSearchQuery) {
      return text;
    }

    const lowerText = text.toLowerCase();
    const matchIndex = lowerText.indexOf(normalizedSearchQuery);

    if (matchIndex === -1) {
      return text;
    }

    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + normalizedSearchQuery.length);
    const after = text.slice(matchIndex + normalizedSearchQuery.length);

    return (
      <>
        {before}
        <mark className={`rounded px-1 ${isOwnMessage ? 'bg-yellow-200 text-black' : 'bg-yellow-300 text-black'}`}>
          {match}
        </mark>
        {after}
      </>
    );
  };

  if (!selectedChat) return <div className="chat-empty-state">Select a chat to start messaging</div>;

  return (
    <section className="chat-main">
      <div className="chat-toolbar">
        <div className="mb-2 flex items-center justify-between">
          <div className="chat-header-user">
            <div className="avatar-wrapper">
              <span className="avatar-initials">
                {selectedChat.username.slice(0, 2).toUpperCase()}
              </span>
              <span
                className={`avatar-status-dot ${(onlineUsers || []).includes(selectedChatId) ? 'online' : 'offline'}`}
              />
            </div>
            <div>
              <h3 className="chat-title">{selectedChat.username}</h3>
              <p className="chat-header-status">
                {onlineUserIds.has(selectedChatId)
                  ? 'online'
                  : lastSeenMap?.[selectedChatId]
                    ? `last seen ${new Date(lastSeenMap[selectedChatId]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'offline'}
              </p>
            </div>
          </div>
          {normalizedSearchQuery && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {visibleMessages.length === 0 ? '0/0' : `${activeMatchIndex + 1}/${visibleMessages.length}`}
              </span>
              <button
                type="button"
                onClick={goToPreviousMatch}
                disabled={visibleMessages.length === 0}
                className="chat-btn"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={goToNextMatch}
                disabled={visibleMessages.length === 0}
                className="chat-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();

                if (event.shiftKey) {
                  goToPreviousMatch();
                } else {
                  goToNextMatch();
                }
              }
            }}
            className="chat-find"
            placeholder="Search in conversation..."
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="chat-btn"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div ref={scrollContainerRef} onScroll={handleMessageListScroll} className="chat-scroll-area">
        {isStickyDateVisible && currentStickyDate && (
          <div className="sticky top-0 left-0 right-0 z-10 mb-4 flex items-center justify-center bg-white bg-opacity-95 py-2">
            <span className="date-chip">
              {currentStickyDate}
            </span>
          </div>
        )}
        {hasOlderMessages && (
          <div className="mb-3 text-center">
            <button
              type="button"
              onClick={handleLoadOlderMessages}
              disabled={isLoadingOlder}
              className="chat-btn"
            >
              {isLoadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}
        {visibleMessages.map((msg, index) => {
          const statusMeta = getStatusMeta(msg);
          const isOwnMessage = isCurrentUserMessage(msg);
          const isActiveSearchMatch = normalizedSearchQuery && index === activeMatchIndex;
          const currentDateValue = msg.timestamp || msg.createdAt;
          const previousDateValue = index > 0
            ? (visibleMessages[index - 1].timestamp || visibleMessages[index - 1].createdAt)
            : null;
          const showDateDivider = toDateKey(currentDateValue) !== toDateKey(previousDateValue);
          const dividerLabel = formatDateDivider(currentDateValue);
          const isActionMenuOpen = actionMenuMessageId === msg._id;
          const isDeleted = Boolean(msg.isDeleted);

          return (
          <div key={msg._id}>
            {showDateDivider && dividerLabel && (
              <div className="my-3 flex items-center justify-center">
                <span className="date-chip">
                  {dividerLabel}
                </span>
              </div>
            )}
            <div
              ref={(element) => {
                matchRefs.current[index] = element;
              }}
              data-date-label={dividerLabel || ''}
              className={`message-row ${isOwnMessage ? 'own' : ''}`}
            >
              <div className={`flex flex-1 flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                <span
                  className={`message-bubble ${isOwnMessage ? 'own' : ''} ${isDeleted ? 'deleted' : ''} ${isActiveSearchMatch ? 'active' : ''}`}
                >
                  {isDeleted ? 'This message was deleted' : renderMessageContent(msg.content, isOwnMessage)}
                </span>
                <div className="message-meta">
                  {formatTimestamp(msg)}
                  {statusMeta && (
                    <span
                      className={`ml-2 inline-flex items-center ${statusMeta.className}`}
                      aria-label={statusMeta.ariaLabel}
                      title={statusMeta.ariaLabel}
                    >
                      <span className="text-[11px] leading-none">{String.fromCharCode(10003)}</span>
                      {statusMeta.ticks === 2 && (
                        <span className="-ml-1 text-[11px] leading-none">{String.fromCharCode(10003)}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative message-actions" data-action-menu="true">
                <button
                  type="button"
                  onClick={() => setActionMenuMessageId(isActionMenuOpen ? null : msg._id)}
                  data-action-trigger="true"
                  className="text-sm"
                  title="Message options"
                >
                  ⋯
                </button>
                {isActionMenuOpen && (
                  <div className={`menu-popup ${isOwnMessage ? 'right-0' : 'left-0'}`}>
                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content)}
                      >
                        Copy
                      </button>
                    )}
                    {isOwnMessage && !isDeleted && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg._id)}
                        className="danger"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
        <div ref={messagesEndRef} />
        {showJumpToLatest && (
          <button
            type="button"
            onClick={handleJumpToLatest}
            className="jump-latest"
            title="Jump to latest messages"
          >
            <span className="text-sm font-medium">Latest messages</span>
            <span className="text-sm">↓</span>
          </button>
        )}
      </div>
      <div className="chat-composer">
        {restoreError && (
          <div className="notice-error">
            {restoreError}
          </div>
        )}
        {undoState && (
          <div className="notice-warning">
            <span>Message deleted ({undoRemainingSeconds}s)</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              disabled={undoRemainingSeconds <= 0}
              className="chat-btn"
            >
              Undo
            </button>
          </div>
        )}
        {activeTypingUser && (
          <div className="mb-2 text-left">
            <span className="typing-chip">
              {activeTypingUser} is typing...
            </span>
          </div>
        )}
        <textarea
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleComposerKeyDown}
          className="composer-input"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={2}
        />
        <button onClick={handleSend} className="chat-btn primary mt-2">Send</button>
      </div>
    </section>
  );
};

export default ChatWindow;