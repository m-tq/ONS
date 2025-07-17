import React, { useState, useEffect } from 'react';
import { WalletConnection } from './components/WalletConnection';
import { DAppInterface } from './components/DAppInterface';
import { WalletProvider } from './contexts/WalletContext';

function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Octra DApp Example
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Example DApp that connects to Octra Web Wallet
            </p>
          </header>
          
          <main className="max-w-4xl mx-auto">
            <WalletConnection />
            <DAppInterface />
          </main>
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;