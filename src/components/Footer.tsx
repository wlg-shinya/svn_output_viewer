import React from 'react';

interface FooterProps {
  statusText: string;
}

export const Footer: React.FC<FooterProps> = ({ statusText }) => {
  return (
    <footer id="statusBar">
      <span>{statusText}</span>
    </footer>
  );
};