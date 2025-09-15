import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaQuestionCircle, FaClipboardList, FaSignOutAlt, FaUserPlus, FaUsers, FaUser, FaCog } from 'react-icons/fa';
import './SideBar.css';

const SideBar = ({ username, role, isOpen = false, onLogout, onClose, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  // Base menu items for all users
  const baseMenuItems = [
    { path: '/home', icon: <FaHome />, label: 'Home' },
    { path: '/profile', icon: <FaUser />, label: 'My Profile' }
  ];

  // Additional menu items for non-user roles
  const additionalMenuItems = [
    { path: '/questions', icon: <FaQuestionCircle />, label: 'Questions' },
    { path: '/responses', icon: <FaClipboardList />, label: 'Responses' },
  ];

  // Combine menu items based on user role
  const menuItems = role === 'user' 
    ? baseMenuItems 
    : [...baseMenuItems, ...additionalMenuItems];

  const adminItems = [
    { path: '/admin/users', icon: <FaUsers />, label: 'Users' },
    { path: '/admin/create-account', icon: <FaUserPlus />, label: 'Create Account' }
  ];

  // Close sidebar when clicking outside on mobile
  const handleClickOutside = (e) => {
    if (isOpen && window.innerWidth < 768) {
      onClose?.();
    }
  };

  // Close sidebar when route changes on mobile
  React.useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      const unlisten = () => onClose?.();
      window.addEventListener('popstate', unlisten);
      return () => window.removeEventListener('popstate', unlisten);
    }
  }, [isOpen, onClose]);

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={handleClickOutside} />
      <div className={`sidebar ${isOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <h2>Quiz Dashboard</h2>
          <button 
            className="close-sidebar" 
            onClick={onClose}
            aria-label="Close sidebar"
          >
            &times;
          </button>
        </div>
      {username && (
        <div 
          className="sidebar-user" 
          onClick={() => navigate('/profile')}
          style={{ cursor: 'pointer' }}
        >
          <div className="user-avatar">{username?.charAt(0).toUpperCase()}</div>
          <div className="user-details" >
            <span className="username">{username}</span>
            {role && <span className="user-role">{role}</span>}
          </div>
        {/*   <FaCog className="user-settings-icon" /> */}
        </div>
      )}
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path} className={isActive(item.path)}>
              <Link to={item.path}>
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </Link>
            </li>
          ))}
          
          {/* Admin Section */}
          {role === 'admin' && (
            <>
              <li className="nav-divider">
                <span>Administration</span>
              </li>
              {adminItems.map((item) => (
                <li key={item.path} className={isActive(item.path)}>
                  <Link to={item.path}>
                    <span className="icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
      </div>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        ☰
      </button>
    </>
  );
};

export default SideBar;
