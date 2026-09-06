'use client';

// ============================================================
// FILE: src/reusablefiles/dashboardshell/Topbar.jsx
//
// Top panel of the dashboard shell: menu toggle (small screens),
// search, action buttons, an extras slot (language switcher lives
// here) and the signed-in user block.
//
//   actions = [{ key, icon, label, badge, onClick }]
//
// All copy is passed in translated.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import InputBox from '@/reusablefiles/inputbox/InputBox';
import Avatar from '@/reusablefiles/avatar/Avatar';

const SearchIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export default function Topbar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchHint,
  actions = [],
  extras = null,
  user = null,
  onMenuToggle,
  menuLabel,
  onUserClick,
  onLogout,
  logoutLabel = 'Log out',
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [profileOpen]);

  const handleLogout = () => {
    setProfileOpen(false);
    onLogout?.();
  };

  return (
    <header className="dash-topbar">
      <button
        type="button"
        className="dash-menu-btn"
        onClick={onMenuToggle}
        aria-label={menuLabel}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {onSearchChange ? (
        <div className="dash-search">
          <InputBox
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            icon={<SearchIcon />}
            hint={searchHint}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      <div className="dash-top-actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className="dash-icon-btn"
            data-key={action.key}
            onClick={action.onClick}
            aria-label={action.label}
          >
            {action.icon}
            {action.badge ? <span className="dash-icon-dot" aria-hidden="true" /> : null}
          </button>
        ))}

        {extras}

        {user ? (
          <div className="dash-profile" ref={profileRef}>
            <button
              type="button"
              className="dash-user"
              onClick={() => {
                setProfileOpen((open) => !open);
                onUserClick?.();
              }}
              aria-label={user.name}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <Avatar name={user.name} src={user.avatar} size="lg" ring />
              <span className="dash-user-who">
                <b>{user.name}</b>
                <span>{user.email}</span>
              </span>
            </button>
            {profileOpen ? (
              <div className="dash-profile-menu" role="menu">
                <div className="dash-profile-summary">
                  <b>{user.name}</b>
                  <span>{user.email}</span>
                </div>
                <button type="button" className="dash-profile-logout" onClick={handleLogout} role="menuitem">
                  {logoutLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
