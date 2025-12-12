import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { CreateScreen } from './components/CreateScreen';
import { HomeScreen } from './components/HomeScreen';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('home');

  const renderScreen = () => {
    switch (currentTab) {
      case 'home':
        return <HomeScreen />;
      case 'create':
        return <CreateScreen onSuccess={() => setCurrentTab('home')} />;
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">О приложении</h1>
            <p className="text-gray-600 leading-relaxed">
              "Поздравляйка" помогает создавать уникальные поздравления с помощью нейросетей. 
            </p>
            <div className="mt-6 p-4 bg-purple-50 rounded-xl">
              <h3 className="font-bold text-purple-900 mb-2">Технологии</h3>
              <ul className="list-disc list-inside text-sm text-purple-800 space-y-1">
                <li>Google Gemini 2.5 Flash (Текст)</li>
                <li>Google Gemini 2.5 Flash Image (Открытки)</li>
              </ul>
            </div>
            <p className="text-xs text-center text-gray-400 mt-10">Версия 1.0.0</p>
          </div>
        );
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Status bar mock */}
      <div className="h-safe-top w-full bg-white/80 backdrop-blur-md sticky top-0 z-40"></div>
      
      <main className="min-h-screen">
        {renderScreen()}
      </main>

      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};

export default App;
