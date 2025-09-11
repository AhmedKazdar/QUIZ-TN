import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaQuestionCircle, FaClipboardList, FaSignOutAlt, FaUserPlus, FaUsers } from 'react-icons/fa';
import './SideBar.css';

const SideBar = ({ username, role, isOpen = false, onLogout }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  const menuItems = [
    { path: '/home', icon: <FaHome />, label: 'Home' },
    { path: '/questions', icon: <FaQuestionCircle />, label: 'Questions' },
    { path: '/responses', icon: <FaClipboardList />, label: 'Responses' }
  ];

  const adminItems = [
    { path: '/admin/users', icon: <FaUsers />, label: 'Users' },
    { path: '/admin/create-account', icon: <FaUserPlus />, label: 'Create Account' }
  ];

  return (
    <div className={`sidebar ${isOpen ? 'active' : ''}`}>
      <div className="sidebar-header">
        <h2>Quiz App</h2>
      </div>
      {username && (
        <div className="sidebar-user">
          <div className="user-avatar">{username?.charAt(0).toUpperCase()}</div>
          <div className="user-details">
            <span className="username" style={{color: 'black'}}>{username}</span>
            {role && <span className="user-role">{role}</span>}
          </div>
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
  );
};

export default SideBar;
