import React from 'react';
import { Header } from './components/Header';
import { ONSInterface } from './components/ONSInterface';
import { WalletProvider } from './contexts/WalletContext';
import { ONSProvider } from './contexts/ONSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ONSProvider>
          <div className="min-h-screen bg-background">
            <Header />
            
            <main className="container mx-auto px-4 py-8">
              <div className="max-w-6xl mx-auto">
                <ONSInterface />
              </div>
            </main>
          </div>
          <Toaster />
        </ONSProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;