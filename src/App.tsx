import React, { useState, useEffect } from 'react';
import { WalletConnection } from './components/WalletConnection';
import { ONSInterface } from './components/ONSInterface';
import { WalletProvider } from './contexts/WalletContext';
import { ONSProvider } from './contexts/ONSContext';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <WalletProvider>
      <ONSProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="container mx-auto px-4 py-8">
            <header className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                ONS - Octra Name Service
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
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