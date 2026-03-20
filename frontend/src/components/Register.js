import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const Register = ({ onRegister }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match');
      return;
    }

    const payload = {
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
    };

    try {
      await axios.post(`${API_BASE_URL}/api/users/register`, payload);
      const loginResponse = await axios.post(`${API_BASE_URL}/api/users/login`, {
        username: payload.username,
        password: payload.password,
      });
      onRegister(loginResponse.data.user);
      setError('');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach backend API. Ensure the backend server is running.');
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
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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