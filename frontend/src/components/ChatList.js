import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChatList = ({ onSelectChat, currentUser }) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/users');
        setUsers(res.data.filter(user => user.username !== currentUser.username));
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    if (currentUser) fetchUsers();
  }, [currentUser]);

  return (
    <div className="w-1/3 bg-gray-200 p-4">
      <h3 className="text-lg font-bold mb-4">Chats</h3>
      <ul>
        {users.map(user => (
          <li
            key={user._id}
            onClick={() => onSelectChat(user)}
            className="p-2 mb-2 bg-white rounded cursor-pointer hover:bg-gray-100"
          >
            {user.username}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatList;