import React from 'react';
import { WalletConnection } from './components/WalletConnection';
import { ONSInterface } from './components/ONSInterface';
import { WalletProvider } from './contexts/WalletContext';
import { ONSProvider } from './contexts/ONSContext';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <WalletProvider>
      <ONSProvider>
        <div className="min-h-screen gradient-bg">
          <div className="container mx-auto px-4 py-8">
            <header className="text-center mb-8">
              <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                ONS - Octra Name Service
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Transform your Octra address into a human-readable domain name
              </p>
            </header>
            
            <main className="max-w-6xl mx-auto">
              <WalletConnection />
              <ONSInterface />
            </main>
          </div>
        </div>
        <Toaster />
      </ONSProvider>
    </WalletProvider>
  );
}

export default App;