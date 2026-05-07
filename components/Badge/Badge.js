import React from 'react';
import styles from './Badge.module.css';

const Badge = ({ children, status }) => {
  const badgeStyle = styles[status?.toLowerCase()] || styles.default;
  return (
    <span className={`${styles.badge} ${badgeStyle}`}>
      {children}
    </span>
  );
};

export default Badge;
