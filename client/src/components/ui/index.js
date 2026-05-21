import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

// Utility function for merging classes
export const cn = (...inputs) => twMerge(clsx(inputs));

// Button Component
export const Button = React.forwardRef(({
  children,
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 focus:ring-primary-500',
    secondary: 'bg-dark-800 hover:bg-dark-700 text-white border border-dark-600 focus:ring-dark-500',
    accent: 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white shadow-lg shadow-accent-500/25 focus:ring-accent-500',
    ghost: 'bg-transparent hover:bg-white/5 text-dark-300 hover:text-white focus:ring-white/20',
    outline: 'bg-transparent border-2 border-primary-500 text-primary-400 hover:bg-primary-500/10 focus:ring-primary-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
  };
  
  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
    sm: 'px-3 py-2 text-sm rounded-lg gap-2',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
    xl: 'px-8 py-4 text-lg rounded-2xl gap-3',
  };

  // Filter out button-specific props when using as Link
  const componentProps = Component === 'button' 
    ? { disabled: disabled || loading, ...props }
    : props;
  
  return (
    <Component
      ref={ref}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...componentProps}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && Icon && iconPosition === 'left' && <Icon className="w-4 h-4" />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-4 h-4" />}
    </Component>
  );
});

Button.displayName = 'Button';

// Input Component
export const Input = React.forwardRef(({
  label,
  error,
  icon: Icon,
  className,
  containerClassName,
  ...props
}, ref) => {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-dark-900/50 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
            'transition-all duration-200',
            Icon && 'pl-11',
            error && 'border-red-500 focus:ring-red-500/50 focus:border-red-500',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea Component
export const Textarea = React.forwardRef(({
  label,
  error,
  className,
  ...props
}, ref) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-dark-900/50 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-dark-400',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
          'transition-all duration-200 resize-none',
          error && 'border-red-500 focus:ring-red-500/50 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Select Component
export const Select = React.forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Select an option',
  className,
  ...props
}, ref) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-dark-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full bg-dark-900/50 border border-dark-700 rounded-xl px-4 py-3 text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
          'transition-all duration-200 appearance-none cursor-pointer',
          'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239fa1a9\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")]',
          'bg-[length:20px] bg-[right_12px_center] bg-no-repeat',
          error && 'border-red-500',
          className
        )}
        {...props}
      >
        <option value="" className="bg-dark-900">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-dark-900">
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

// Card Component
export const Card = ({ children, className, hover = false, glow = false, ...props }) => {
  return (
    <div
      className={cn(
        'bg-dark-900/50 border border-dark-800 rounded-2xl p-6',
        'backdrop-blur-xl',
        hover && 'hover-lift cursor-pointer',
        glow && 'neon-glow',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Avatar Component
export const Avatar = ({ src, alt, size = 'md', status, className }) => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl',
  };
  
  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-dark-500',
    away: 'bg-amber-500',
    busy: 'bg-red-500',
  };
  
  const initials = alt?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  
  return (
    <div className={cn('relative inline-flex', className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            'rounded-full object-cover ring-2 ring-dark-700',
            sizes[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center font-semibold text-white',
            sizes[size]
          )}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-dark-900',
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};

// Badge Component
export const Badge = ({ children, variant = 'default', size = 'md', icon: Icon, className }) => {
  const variants = {
    default: 'bg-dark-700 text-dark-200',
    primary: 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
};

// Spinner Component
export const Spinner = ({ size = 'md', className }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };
  
  return (
    <div className={cn('spinner', sizes[size], className)} />
  );
};

// Tooltip Component
export const Tooltip = ({ children, content, position = 'top' }) => {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  
  return (
    <div className="relative group inline-block">
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-dark-800 rounded-lg',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200',
          'whitespace-nowrap',
          positions[position]
        )}
      >
        {content}
      </div>
    </div>
  );
};

// Progress Bar Component
export const ProgressBar = ({ value, max = 100, color = 'primary', showLabel = false, className }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colors = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-400',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-400',
    danger: 'bg-gradient-to-r from-red-500 to-red-400',
  };
  
  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-dark-400 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
};

// Empty State Component
export const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-dark-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-dark-400 text-sm max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

// Divider Component
export const Divider = ({ label, className }) => {
  if (label) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex-1 h-px bg-dark-700" />
        <span className="text-sm text-dark-400">{label}</span>
        <div className="flex-1 h-px bg-dark-700" />
      </div>
    );
  }
  
  return <div className={cn('h-px bg-dark-700', className)} />;
};

// Skeleton Component
export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-dark-800 rounded-lg',
        className
      )}
      {...props}
    />
  );
};

const ui = {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  Avatar,
  Badge,
  Spinner,
  Tooltip,
  ProgressBar,
  EmptyState,
  Divider,
  Skeleton,
  cn,
};

export default ui;
