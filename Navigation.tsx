import React from 'react';
import { Home, PlusCircle, Settings } from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      <button 
        onClick={() => onTabChange('home')}
        className={`flex flex-col items-center space-y-1 ${currentTab === 'home' ? 'text-purple-600' : 'text-gray-400'}`}
      >
        <Home size={24} />
        <span className="text-xs font-medium">Главная</span>
      </button>

      <button 
        onClick={() => onTabChange('create')}
        className="flex flex-col items-center justify-center -mt-8 bg-purple-600 rounded-full w-14 h-14 shadow-lg text-white hover:bg-purple-700 transition-colors"
      >
        <PlusCircle size={32} />
      </button>

      <button 
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center space-y-1 ${currentTab === 'settings' ? 'text-purple-600' : 'text-gray-400'}`}
      >
        <Settings size={24} />
        <span className="text-xs font-medium">Инфо</span>
      </button>
    </div>
  );
};
