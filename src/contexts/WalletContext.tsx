import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  publicKey: string | null;
}

interface WalletContextType {
  wallet: WalletState;
  connectWallet: () => void;
  disconnectWallet: () => void;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    publicKey: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // Check for existing connection on load
  useEffect(() => {
    const savedWallet = localStorage.getItem('octra-dapp-wallet');
    if (savedWallet) {
      try {
        const walletData = JSON.parse(savedWallet);
        setWallet({
          isConnected: true,
          address: walletData.address,
          publicKey: walletData.publicKey,
        });
      } catch (error) {
        console.error('Failed to parse saved wallet data:', error);
        localStorage.removeItem('octra-dapp-wallet');
      }
    }

    // Handle wallet connection callback
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('account_id');
    const publicKey = urlParams.get('public_key');

    if (accountId && publicKey) {
      const walletData = {
        address: accountId,
        publicKey: publicKey,
      };

      setWallet({
        isConnected: true,
        address: accountId,
        publicKey: publicKey,
      });

      // Save to localStorage
      localStorage.setItem('octra-dapp-wallet', JSON.stringify(walletData));

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setIsConnecting(false);
    }
  }, []);

  const connectWallet = () => {
    setIsConnecting(true);
    
    // URL wallet Octra Anda - sesuaikan dengan URL deployment wallet
    const walletUrl = 'http://localhost:5173'; // Ganti dengan URL wallet Anda
    // const walletUrl = 'https://octra.xme.my.id'; // Ganti dengan URL wallet Anda
    
    // 
    // URL callback untuk DApp ini
    const currentUrl = window.location.origin + window.location.pathname;
    const successUrl = currentUrl;
    const failureUrl = currentUrl + '?error=connection_rejected';
    
    // Parameter untuk wallet connection
    const params = new URLSearchParams({
      success_url: successUrl,
      failure_url: failureUrl,
      origin: window.location.origin,
      app_name: 'Octra DApp Example'
    });

    // Redirect ke wallet untuk connection
    window.location.href = `${walletUrl}?${params.toString()}`;
  };

  const disconnectWallet = () => {
    setWallet({
      isConnected: false,
      address: null,
      publicKey: null,
    });
    localStorage.removeItem('octra-dapp-wallet');
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      connectWallet,
      disconnectWallet,
      isConnecting
    }}>
      {children}
    </WalletContext.Provider>
  );
}