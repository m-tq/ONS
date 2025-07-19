import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  isProcessingTransaction: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface PendingTransaction {
  timestamp: number;
  to: string;
  amount: string;
  message?: string;
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
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
  const [walletWindow, setWalletWindow] = useState<Window | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pendingTransactionResolve, setPendingTransactionResolve] = useState<((value: string | null) => void) | null>(null);
  const [pendingTransactionReject, setPendingTransactionReject] = useState<((reason?: any) => void) | null>(null);
  const [processedTransactions, setProcessedTransactions] = useState<Set<string>>(new Set());

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

  // Helper functions for pending transaction management
  const savePendingTransaction = (transaction: PendingTransaction) => {
    localStorage.setItem('octra-dapp-pending-tx', JSON.stringify(transaction));
  };

  const getPendingTransaction = (): PendingTransaction | null => {
    try {
      const saved = localStorage.getItem('octra-dapp-pending-tx');
      if (saved) {
        const transaction = JSON.parse(saved);
        // Check if transaction is not too old (5 minutes)
        if (Date.now() - transaction.timestamp < 300000) {
          return transaction;
        }
      }
    } catch (error) {
      console.error('Error parsing pending transaction:', error);
    }
    return null;
  };

  const clearPendingTransaction = () => {
    localStorage.removeItem('octra-dapp-pending-tx');
  };

  const addProcessedTransaction = (txHash: string) => {
    setProcessedTransactions(prev => new Set([...prev, txHash]));
    // Store in localStorage to persist across page reloads
    const processed = Array.from(processedTransactions);
    processed.push(txHash);
    // Keep only last 10 transactions to avoid memory issues
    const recent = processed.slice(-10);
    localStorage.setItem('octra-dapp-processed-tx', JSON.stringify(recent));
  };

  const isTransactionProcessed = (txHash: string): boolean => {
    return processedTransactions.has(txHash);
  };

  // Check for existing connection on load
  useEffect(() => {
    // Restore processed transactions from localStorage
    try {
      const stored = localStorage.getItem('octra-dapp-processed-tx');
      if (stored) {
        const processed = JSON.parse(stored);
        setProcessedTransactions(new Set(processed));
      }
    } catch (error) {
      console.error('Error restoring processed transactions:', error);
    }

    // Handle URL params only once on mount
    const urlParams = new URLSearchParams(window.location.search);
    const txSuccess = urlParams.get('tx_success');
    const txError = urlParams.get('tx_error');
    const txHash = urlParams.get('tx_hash');
    const accountId = urlParams.get('account_id');
    const publicKey = urlParams.get('public_key');

    console.log('URL Params:', { txSuccess, txError, txHash, accountId, publicKey });

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
      console.log('Transaction success detected:', txHash);
      
      // Check if this transaction was already processed
      const storedProcessed = localStorage.getItem('octra-dapp-processed-tx');
      let processedTxs: string[] = [];
      try {
        processedTxs = storedProcessed ? JSON.parse(storedProcessed) : [];
      } catch (error) {
        console.error('Error parsing processed transactions:', error);
      }
      
      if (processedTxs.includes(txHash)) {
        console.log('Transaction already processed, skipping:', txHash);
        // Clean URL without processing
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Check if we have a pending transaction
      const pendingTx = getPendingTransaction();
      console.log('Pending transaction found:', pendingTx);
      
      // Mark transaction as processed
      processedTxs.push(txHash);
      // Keep only last 10 transactions
      const recentTxs = processedTxs.slice(-10);
      localStorage.setItem('octra-dapp-processed-tx', JSON.stringify(recentTxs));
      setProcessedTransactions(new Set(recentTxs));
      
      // Dispatch custom event for ONS context to handle with a small delay
      // to ensure wallet address is properly set
      setTimeout(() => {
      window.dispatchEvent(new CustomEvent('transactionSuccess', { 
        detail: { txHash, pendingTransaction: pendingTx } 
      }));
      
      setIsProcessingTransaction(false);
      clearPendingTransaction();
      
      // Resolve pending transaction promise
      if (pendingTransactionResolve) {
        console.log('Resolving pending transaction promise');
        pendingTransactionResolve(txHash);
        setPendingTransactionResolve(null);
        setPendingTransactionReject(null);
      } else {
        console.log('No pending transaction resolve found, but event dispatched for ONS context');
      }
    }

    // Handle transaction error
    if (txError === 'true') {
      console.log('Transaction error detected');
      setIsProcessingTransaction(false);
      clearPendingTransaction();
      
      // Reject pending transaction promise
      if (pendingTransactionReject) {
        pendingTransactionReject(new Error('Transaction failed or was cancelled'));
        setPendingTransactionResolve(null);
        setPendingTransactionReject(null);
      }
    }

    // Clean up URL if there are any params
    if (txSuccess || txError || accountId) {
      // Clean URL immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Listen for messages from wallet window
    const handleMessage = (event: MessageEvent) => {
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
        setIsProcessingTransaction(false);
        clearPendingTransaction();
        
        // Resolve pending transaction promise
        if (pendingTransactionResolve) {
          pendingTransactionResolve(txHash);
          setPendingTransactionResolve(null);
          setPendingTransactionReject(null);
        }
        
        // Dispatch custom event for ONS context to handle
        window.dispatchEvent(new CustomEvent('transactionSuccess', { 
          detail: { txHash } 
        }));
      }, 500);
        
        if (walletWindow) {
          walletWindow.close();
          setWalletWindow(null);
        }
      } else if (event.data.type === 'WALLET_TRANSACTION_REJECTED') {
        setIsProcessingTransaction(false);
        clearPendingTransaction();
        
        // Reject pending transaction promise
        if (pendingTransactionReject) {
          pendingTransactionReject(new Error('Transaction was rejected'));
          setPendingTransactionResolve(null);
          setPendingTransactionReject(null);
        }
        
        if (walletWindow) {
          walletWindow.close();
          setWalletWindow(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);

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

    // Check if we're returning from a transaction and restore processing state
    const pendingTx = getPendingTransaction();
    if (pendingTx) {
      console.log('Restoring transaction processing state');
      setIsProcessingTransaction(true);
    }
    
    // Cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []); // Empty dependency array to run only once on mount

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

    setIsProcessingTransaction(true);

    // Save pending transaction info
    const pendingTransaction: PendingTransaction = {
      timestamp: Date.now(),
      to,
      amount,
      message
    };
    savePendingTransaction(pendingTransaction);
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

      // Return promise yang akan di-resolve setelah redirect kembali
      return new Promise((resolve, reject) => {
        // Store promise resolvers
        setPendingTransactionResolve(() => resolve);
        setPendingTransactionReject(() => reject);
        
        // Set timeout untuk menghindari hanging promise
        const timeout = setTimeout(() => {
          setIsProcessingTransaction(false);
          clearPendingTransaction();
          setPendingTransactionResolve(null);
          setPendingTransactionReject(null);
          reject(new Error('Transaction timeout'));
        }, 300000); // 5 menit timeout

        // Clear timeout when promise resolves/rejects
        const originalResolve = resolve;
        const originalReject = reject;
        
        setPendingTransactionResolve(() => (value: string | null) => {
          clearTimeout(timeout);
          clearPendingTransaction();
          originalResolve(value);
        });
        
        setPendingTransactionReject(() => (reason?: any) => {
          clearTimeout(timeout);
          clearPendingTransaction();
          originalReject(reason);
        });
        
        // Redirect ke wallet untuk transaction
        window.location.href = `${walletUrl}?${params.toString()}`;
      });
    } catch (error) {
      console.error('Error sending transaction:', error);
      setIsProcessingTransaction(false);
      clearPendingTransaction();
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
    clearPendingTransaction();
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      connectWallet,
      disconnectWallet,
      isConnecting,
      sendTransaction,
      isProcessingTransaction,
    }}>
      {children}
    </WalletContext.Provider>
  );
}