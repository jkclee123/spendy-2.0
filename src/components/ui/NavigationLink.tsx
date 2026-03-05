import { AnchorHTMLAttributes } from "react";
import { Link } from "react-router-dom";

export interface NavigationLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: React.ReactNode;
}

export function NavigationLink({ href, children, ...props }: NavigationLinkProps) {
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}
