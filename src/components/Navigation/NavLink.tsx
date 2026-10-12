import React from 'react';

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  className?: string;
  children: React.ReactNode;
  activeClassName?: string;
  isActive?: boolean;
}

export const NavLink: React.FC<NavLinkProps> = ({
  href,
  className = '',
  activeClassName = '',
  isActive = false,
  children,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only intercept plain left clicks with no modifier keys
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (window.location.hash !== href) {
        window.location.hash = href;
      }
      if (onClick) {
        onClick(e);
      }
    }
    // If Ctrl/Cmd/Shift/Alt or middle click is pressed, default browser behavior opens in new tab!
  };

  const combinedClasses = `${className} ${isActive ? activeClassName : ''}`.trim();

  return (
    <a
      href={href}
      onClick={handleClick}
      className={combinedClasses}
      {...props}
    >
      {children}
    </a>
  );
};
