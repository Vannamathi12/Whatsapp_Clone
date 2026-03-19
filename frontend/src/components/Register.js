import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Register = ({ onRegister }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
    };

    try {
      await axios.post('http://localhost:5000/api/users/register', payload);
      const loginResponse = await axios.post('http://localhost:5000/api/users/login', {
        username: payload.username,
        password: payload.password,
      });
      onRegister(loginResponse.data.user);
      setError('');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach backend API. Start backend on http://localhost:5000.');
      } else {
        setError(err.response?.data?.error || 'Registration failed');
      }
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h2 className="auth-title">Create account</h2>
        <p className="auth-subtitle">Join your team chat with a new profile.</p>
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <button type="submit" className="auth-submit">Register</button>
        <div className="auth-switch">
          <span>Already have an account? </span>
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Register;