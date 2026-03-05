"use client";

import { forwardRef, InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, error, disabled, ...props }, ref) => {
    return (
      <div className={className}>
        <label
          className={`
            flex items-center gap-3 cursor-pointer
            ${disabled ? "cursor-not-allowed opacity-50" : ""}
          `}
        >
          <div className="relative flex items-center">
            <input
              ref={ref}
              type="checkbox"
              disabled={disabled}
              className={`
                peer h-5 w-5 cursor-pointer appearance-none rounded-md border
                border-gray-400 dark:border-gray-500 bg-white transition-all duration-200
                checked:border-blue-500 checked:bg-blue-500
                hover:border-black dark:hover:border-gray-400
                focus:outline-none
                disabled:cursor-not-allowed disabled:bg-gray-100
                ${error ? "border-red-500 focus:ring-red-500" : ""}
              `}
              {...props}
            />
            <svg
              className="
                pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100
                transition-opacity duration-200
              "
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
              {label}
            </span>
          )}
        </label>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
