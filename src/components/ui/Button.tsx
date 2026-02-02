import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react'; // Ensure you have lucide-react installed

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'oauth';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  glow?: boolean; // New prop: Adds extra neon intensity
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  glow = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  
  // 1. Base Styles (Layout, Fonts, Transitions)
  const baseStyles = "relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquoise-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1316] disabled:opacity-50 disabled:pointer-events-none active:scale-95";

  // 2. Size Config
  const sizes = {
    sm: "px-3 py-1.5 text-xs h-8 rounded-md",
    md: "px-5 py-2.5 text-sm h-11 rounded-lg",
    lg: "px-8 py-3.5 text-base h-14 rounded-xl",
  };

  // 3. Variant Config (The "Graphite & Turquoise" Look)
  const variants = {
    primary: `
      bg-[#2dd4bf] text-[#0f1316] border border-transparent 
      hover:bg-[#5eead4] hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]
    `,
    secondary: `
      bg-[#1a2026] text-[#eceef0] border border-[#262e35]
      hover:border-[#2dd4bf]/50 hover:bg-[#262e35] hover:text-white
    `,
    ghost: `
      bg-transparent text-[#7e909e] 
      hover:text-[#2dd4bf] hover:bg-[#2dd4bf]/10
    `,
    danger: `
      bg-[#f43f5e] text-white border border-transparent
      hover:bg-[#fb7185] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]
    `,
    oauth: `
      bg-white text-gray-900 border border-gray-200
      hover:bg-gray-50
    `,
  };

  // 4. Construct Class String
  const classes = [
    baseStyles,
    sizes[size],
    variants[variant],
    fullWidth ? 'w-full' : '',
    glow && variant === 'primary' ? 'shadow-[0_0_15px_rgba(45,212,191,0.5)]' : '',
    className,
  ].join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Loading Spinner Overlay */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin w-5 h-5" />
        </span>
      )}

      {/* Content Content (Hidden when loading to preserve width) */}
      <span className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </span>
    </button>
  );
};

export default Button;