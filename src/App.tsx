import React from 'react';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { ONSInterface } from './components/ONSInterface';
import { WalletProvider } from './contexts/WalletContext';
import { ONSProvider } from './contexts/ONSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useWallet } from './contexts/WalletContext';
import { useONS } from './contexts/ONSContext';
import { Toaster } from './components/ui/toaster';

function AppContent() {
  const { wallet } = useWallet();
  const { setWalletAddressFromContext } = useONS();

  useEffect(() => {
    setWalletAddressFromContext(wallet.address);
  }, [wallet.address, setWalletAddressFromContext]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <ONSInterface />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ONSProvider>
          <AppContent />
          <Toaster />
        </ONSProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;