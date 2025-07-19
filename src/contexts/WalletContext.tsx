import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useONS } from './ONSContext';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  publicKey: string | null;
}

interface WalletContextType {
  wallet: WalletState;
  connectWallet: (providerUrl?: string) => void;
  disconnectWallet: () => void;
  isConnecting: boolean;
  sendTransaction: (to: string, amount: string, message?: string) => Promise<string | null>;
  handleTransactionSuccess: (txHash: string) => Promise<void>;
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
  const onsContext = useONS();
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    publicKey: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // Check for existing connection on load
  useEffect(() => {
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const txSuccess = urlParams.get('tx_success');
      const txHash = urlParams.get('tx_hash');
      const accountId = urlParams.get('account_id');
      const publicKey = urlParams.get('public_key');

      // Handle wallet connection callback
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
        setIsConnecting(false);
      }

      // Handle transaction success
      if (txSuccess === 'true' && txHash) {
        await handleTransactionSuccess(txHash);
      }

      // Clean up URL if there are any params
      if (urlParams.toString()) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

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

    handleUrlParams();
  }, []);

  const handleTransactionSuccess = async (txHash: string) => {
    if (!onsContext) return;
    
    try {
      // Verify and process the transaction
      await onsContext.verifyAndProcessTransaction(txHash);
    } catch (error) {
      console.error('Error handling transaction success:', error);
    }
  };

  const connectWallet = (providerUrl?: string) => {
    setIsConnecting(true);
    
    // Use provided URL or default from environment
    const defaultProviders = import.meta.env.VITE_WALLET_PROVIDERS || 'localhost:5173';
    const firstProvider = defaultProviders.split(',')[0].trim();
    const walletUrl = providerUrl || (firstProvider.startsWith('http') ? firstProvider : `https://${firstProvider}`);
    
    // URL callback untuk DApp ini
    const currentUrl = window.location.origin + window.location.pathname;
    const successUrl = currentUrl;
    const failureUrl = currentUrl + '?error=connection_rejected';
    
    // Parameter untuk wallet connection
    const params = new URLSearchParams({
      success_url: successUrl,
      failure_url: failureUrl,
      origin: window.location.origin,
      app_name: import.meta.env.VITE_APP_NAME || 'ONS - Octra Name Service'
    });

    // Redirect ke wallet untuk connection
    window.location.href = `${walletUrl}?${params.toString()}`;
  };

  const sendTransaction = async (to: string, amount: string, message?: string): Promise<string | null> => {
    if (!wallet.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      // Use default wallet provider
      const defaultProviders = import.meta.env.VITE_WALLET_PROVIDERS || 'localhost:5173';
      const firstProvider = defaultProviders.split(',')[0].trim();
      const walletUrl = firstProvider.startsWith('http') ? firstProvider : `https://${firstProvider}`;
      
      // URL callback untuk DApp ini
      const currentUrl = window.location.origin + window.location.pathname;
      const successUrl = currentUrl + '?tx_success=true';
      const failureUrl = currentUrl + '?tx_error=true';
      
      // Parameter untuk transaction request
      const params = new URLSearchParams({
        action: 'send',
        to: to,
        amount: amount,
        success_url: successUrl,
        failure_url: failureUrl,
        origin: window.location.origin,
        app_name: import.meta.env.VITE_APP_NAME || 'ONS - Octra Name Service'
      });

      // Tambahkan message jika ada
      if (message) {
        params.append('message', message);
      }

      // Redirect ke wallet untuk transaction
      window.location.href = `${walletUrl}?${params.toString()}`;
      
      // Return promise yang akan di-resolve setelah redirect kembali
      return new Promise((resolve, reject) => {
        // Set timeout untuk menghindari hanging promise
        const timeout = setTimeout(() => {
          reject(new Error('Transaction timeout'));
        }, 300000); // 5 menit timeout

        // Check for transaction result in URL params
        const checkResult = () => {
          const urlParams = new URLSearchParams(window.location.search);
          const txSuccess = urlParams.get('tx_success');
          const txError = urlParams.get('tx_error');
          const txHash = urlParams.get('tx_hash');

          if (txSuccess === 'true' && txHash) {
            clearTimeout(timeout);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            resolve(txHash);
          } else if (txError === 'true') {
            clearTimeout(timeout);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            reject(new Error('Transaction failed'));
          }
        };

        // Check immediately and then periodically
        checkResult();
        const interval = setInterval(checkResult, 1000);
        
        // Clear interval when promise resolves/rejects
        setTimeout(() => clearInterval(interval), 300000);
      });
    } catch (error) {
      console.error('Error sending transaction:', error);
      return null;
    }
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
      isConnecting,
      sendTransaction,
      handleTransactionSuccess
    }}>
      {children}
    </WalletContext.Provider>
  );
}