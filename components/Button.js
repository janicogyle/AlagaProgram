'use client';

import Link from 'next/link';
import styles from './Button.module.css';

export default function Button({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  size = 'medium',
  fullWidth = false,
  disabled = false,
  icon = null,
  className = '',
  href
}) {
  const buttonClasses = `
    ${styles.button} 
    ${styles[variant]} 
    ${styles[size]} 
    ${fullWidth ? styles.fullWidth : ''} 
    ${className}
  `.trim();

  if (href && !disabled) {
    return (
      <Link href={href} className={buttonClasses} onClick={onClick}>
        {icon && <span className={styles.icon}>{icon}</span>}
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
}
