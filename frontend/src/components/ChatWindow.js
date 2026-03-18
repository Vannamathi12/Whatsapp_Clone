import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const ChatWindow = ({ selectedChat, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      const fetchMessages = async () => {
        try {
          const res = await axios.get(`http://localhost:5000/api/messages/${selectedChat._id}?sender=${currentUser.id}`);
          setMessages(res.data);
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      };
      fetchMessages();
    }
  }, [selectedChat, currentUser]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('receiveMessage', (data) => {
        setMessages(prev => [...prev, data]);
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const messageData = {
      sender: currentUser.id,
      receiver: selectedChat._id,
      content: newMessage,
    };
    try {
      const res = await axios.post('http://localhost:5000/api/messages', messageData);
      setMessages(prev => [...prev, res.data]);
      socketRef.current.emit('sendMessage', res.data);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (!selectedChat) return <div className="w-2/3 flex items-center justify-center">Select a chat to start messaging</div>;

  return (
    <div className="w-2/3 flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg._id} className={`mb-2 ${msg.sender._id === currentUser.id ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded ${msg.sender._id === currentUser.id ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
              {msg.content}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="w-full p-2 border rounded"
          placeholder="Type a message..."
        />
        <button onClick={handleSend} className="mt-2 bg-blue-500 text-white p-2 rounded">Send</button>
      </div>
    </div>
  );
};

export default ChatWindow;