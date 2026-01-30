/**
 * Button - Reusable button component with multiple variants
 * Supports loading state, disabled state, and icon placement
 */
import { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'oauth';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) => {
  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full-width' : '',
    isLoading ? 'btn--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="btn__spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="btn__spinner-icon">
            <circle cx="12" cy="12" r="10" fill="none" strokeWidth="3" />
          </svg>
        </span>
      )}
      {!isLoading && leftIcon && <span className="btn__icon btn__icon--left">{leftIcon}</span>}
      <span className="btn__text">{children}</span>
      {!isLoading && rightIcon && <span className="btn__icon btn__icon--right">{rightIcon}</span>}
    </button>
  );
};

export default Button;
