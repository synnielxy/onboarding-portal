import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store } from './store/store';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import VisaStatus from './pages/VisaStatus';
import HiringManagement from './pages/HiringManagement';
import HRVisaManagement from './pages/HRVisaManagement';
import EmployeeProfiles from './pages/EmployeeProfiles';
import { useEffect } from 'react';
import { loadUser, logout } from './store/slices/authSlice';
import Navbar from './components/Navbar';
import { RootState } from './store/store';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import HrHome from './pages/HrHome';

const AppContent = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <Router>
      <Toaster position="top-right" />
      {user && <Navbar onLogout={handleLogout} />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/home"
          element={
            <ProtectedRoute>
              <HrHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visa"
          element={
            <ProtectedRoute>
              <VisaStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visa-management"
          element={
            <ProtectedRoute>{user?.isAdmin ? <HRVisaManagement /> : <Navigate to="/" replace />}</ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee-profiles"
          element={
            <ProtectedRoute>
              <EmployeeProfiles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hiring-management"
          element={
            <ProtectedRoute>{user?.isAdmin ? <HiringManagement /> : <Navigate to="/" replace />}</ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
