import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "SM" | "LG";
  variant?: "ghost" | "primary";
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = "SM", variant = "ghost", leadingIcon, trailingIcon, className = "", children, ...props }, ref,
) {
  return <button ref={ref} type="button" className={`nuance-button nuance-button--${variant} nuance-button--${size.toLowerCase()} ${className}`} {...props}>
    {leadingIcon}<span>{children}</span>{trailingIcon}
  </button>;
});
