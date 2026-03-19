import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/users/login', { username, password });
      onLogin(res.data.user);
      setError('');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach backend API. Start backend on http://localhost:5000.');
      } else {
        setError(err.response?.data?.error || 'Invalid credentials');
      }
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to continue your conversations.</p>
        {error && <p className="auth-error">{error}</p>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="auth-input"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
          required
        />
        <button type="submit" className="auth-submit">Login</button>
        <div className="auth-switch">
          <span>Don't have an account? </span>
          <Link to="/register" className="auth-link">
            Register
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;