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
  const [walletWindow, setWalletWindow] = useState<Window | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Helper function to get wallet providers
  const getWalletProviders = () => {
    const providersEnv = import.meta.env.VITE_WALLET_PROVIDERS || 'octra.xme.my.id,localhost:5173';
    const useHttps = import.meta.env.VITE_WALLET_USE_HTTPS === 'true';
    const providerUrls = providersEnv.split(',').map(url => url.trim());
    
    return providerUrls.map(url => {
      const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
      const protocol = isLocal && !useHttps ? 'http' : 'https';
      const fullUrl = url.startsWith('http') ? url : `${protocol}://${url}`;
      
      return {
        name: isLocal ? 'Local Development Wallet' : 'Octra Web Wallet',
        url: fullUrl,
        description: isLocal 
          ? 'Development wallet running locally'
          : 'Official Octra Web Wallet',
        isLocal
      };
    });
  };

  // Check for existing connection on load
  useEffect(() => {
    // Listen for messages from wallet window
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      const allowedOrigins = getWalletProviders().map(provider => {
        try {
          return new URL(provider.url).origin;
        } catch {
          return '';
        }
      }).filter(Boolean);

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      if (event.data.type === 'WALLET_CONNECTION_SUCCESS') {
        const { address, publicKey } = event.data;
        if (address && publicKey) {
          const walletData = { address, publicKey };
          
          setWallet({
            isConnected: true,
            address,
            publicKey,
          });

          localStorage.setItem('octra-dapp-wallet', JSON.stringify(walletData));
          setIsConnecting(false);
          
          // Save the provider that was used for connection
          if (walletWindow) {
            const providers = getWalletProviders();
            const provider = providers.find(p => {
              try {
                return new URL(p.url).origin === event.origin;
              } catch {
                return false;
              }
            });
            if (provider) {
              setSelectedProvider(provider.url);
              localStorage.setItem('octra-dapp-selected-provider', provider.url);
            }
          }
          
          // Close wallet window
          if (walletWindow) {
            walletWindow.close();
            setWalletWindow(null);
          }
        }
      } else if (event.data.type === 'WALLET_CONNECTION_REJECTED') {
        setIsConnecting(false);
        if (walletWindow) {
          walletWindow.close();
          setWalletWindow(null);
        }
      } else if (event.data.type === 'WALLET_TRANSACTION_SUCCESS') {
        const { txHash } = event.data;
        if (txHash && onsContext) {
          onsContext.verifyAndProcessTransaction(txHash);
        }
        if (walletWindow) {
          walletWindow.close();
          setWalletWindow(null);
        }
      } else if (event.data.type === 'WALLET_TRANSACTION_REJECTED') {
        if (walletWindow) {
          walletWindow.close();
          setWalletWindow(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);

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
        
        // Try to determine which provider was used based on referrer or current URL
        const savedProvider = localStorage.getItem('octra-dapp-selected-provider');
        if (savedProvider) {
          setSelectedProvider(savedProvider);
        }
        
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
        
        // Restore selected provider
        const savedProvider = localStorage.getItem('octra-dapp-selected-provider');
        if (savedProvider) {
          setSelectedProvider(savedProvider);
        }
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
    
    // Use provided URL or get from providers list
    let walletUrl = providerUrl;
    if (!walletUrl) {
      const providers = getWalletProviders();
      walletUrl = providers[0]?.url || 'https://octra.xme.my.id';
    }
    
    // Save selected provider
    setSelectedProvider(walletUrl);
    localStorage.setItem('octra-dapp-selected-provider', walletUrl);
    
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
      // Use the same provider that was used for connection
      let walletUrl = selectedProvider;
      if (!walletUrl) {
        // Fallback to saved provider or first available
        const savedProvider = localStorage.getItem('octra-dapp-selected-provider');
        if (savedProvider) {
          walletUrl = savedProvider;
          setSelectedProvider(savedProvider);
        } else {
          const providers = getWalletProviders();
          walletUrl = providers[0]?.url || 'https://octra.xme.my.id';
        }
      }
      
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
    setSelectedProvider(null);
    localStorage.removeItem('octra-dapp-wallet');
    localStorage.removeItem('octra-dapp-selected-provider');
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      connectWallet,
      disconnectWallet,
      isConnecting,
      sendTransaction,
    }}>
      {children}
    </WalletContext.Provider>
  );
}