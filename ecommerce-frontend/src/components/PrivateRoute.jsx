import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthToken } from '../utils/auth';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = !!getAuthToken();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;