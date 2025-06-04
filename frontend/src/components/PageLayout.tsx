import React from 'react';
import Navigation from './Navigation';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  backTo?: string;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl' | 'full';
  padding?: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  backTo = "/",
  className = "",
  maxWidth = "7xl",
  padding = true
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 ${className}`}>
      <Navigation 
        title={title}
        showBackButton={showBackButton}
        backTo={backTo}
      />
      
      <main className={`${maxWidthClasses[maxWidth]} mx-auto ${padding ? 'px-4 sm:px-6 lg:px-8 py-8' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default PageLayout; 