import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-black dark:bg-white text-gray-100 dark:text-gray-900 shadow-sm hover:bg-gray-800 dark:hover:bg-gray-200",
  secondary:
    "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 focus:ring-gray-500",
  outline:
    "border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-black hover:text-black dark:hover:border-gray-400 focus:ring-offset-0 focus:ring-transparent dark:hover:text-white",
  ghost:
    "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 focus:ring-gray-500",
  danger:
    "bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500 shadow-sm",
  warning:
    "bg-yellow-500 dark:bg-yellow-600 text-white hover:bg-yellow-600 dark:hover:bg-yellow-700 focus:ring-yellow-500 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm min-h-[36px]",
  md: "px-4 py-2 text-base min-h-[44px]",
  lg: "px-6 py-3 text-lg min-h-[52px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center gap-2 rounded-xl font-medium
          transition-all duration-200 focus:outline-none
          disabled:cursor-not-allowed disabled:opacity-20
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
