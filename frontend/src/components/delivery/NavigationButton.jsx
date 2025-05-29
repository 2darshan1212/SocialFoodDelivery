import React from 'react';
import { useNavigate } from 'react-router-dom';

const NavigationButton = ({ icon, label, path, currentPath }) => {
  const navigate = useNavigate();
  
  const isActive = currentPath === path;
  
  return (
    <button 
      onClick={() => navigate(path)}
      className={`
        flex flex-col items-center justify-center p-2 
        ${isActive 
          ? 'text-indigo-600' 
          : 'text-gray-600 hover:text-indigo-600'
        }
      `}
    >
      {React.cloneElement(icon, { className: isActive ? 'text-indigo-600' : 'text-gray-600' })}
      <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>
        {label}
      </span>
    </button>
  );
};

export default NavigationButton;
