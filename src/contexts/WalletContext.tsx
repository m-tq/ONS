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
  const [connectionAttemptId, setConnectionAttemptId] = useState<string | null>(null);

  // Helper function to get wallet providers
  const getWalletProviders = () => {
    const providersEnv = import.meta.env.VITE_WALLET_PROVIDERS || 'octra.xme.my.id,localhost:5173';
    const useHttps = import.meta.env.VITE_WALLET_USE_HTTPS === 'true';
    const providerUrls = providersEnv.split(',').map((url: string) => url.trim());
    
    return providerUrls.map((url: string) => {
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
    // Listen for storage changes (cross-tab communication)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'octra-dapp-wallet-connected' && event.newValue) {
        try {
          const connectionData = JSON.parse(event.newValue);
          const currentAttemptId = localStorage.getItem('octra-dapp-connection-attempt');
          
          // Check if this connection is for our current attempt
          if (connectionData.attemptId === currentAttemptId) {
            console.log('Cross-tab wallet connection detected:', connectionData);
            
            setWallet({
              isConnected: true,
              address: connectionData.address,
              publicKey: connectionData.publicKey,
            });
            
            setSelectedProvider(connectionData.provider);
            setIsConnecting(false);
            
            // Save wallet data
            localStorage.setItem('octra-dapp-wallet', JSON.stringify({
              address: connectionData.address,
              publicKey: connectionData.publicKey,
            }));
            localStorage.setItem('octra-dapp-selected-provider', connectionData.provider);
            
            // Clean up connection attempt
            localStorage.removeItem('octra-dapp-connection-attempt');
            localStorage.removeItem('octra-dapp-wallet-connected');
            
            // Close wallet window if it exists
            if (walletWindow && !walletWindow.closed) {
              walletWindow.close();
              setWalletWindow(null);
            }
          }
        } catch (error) {
          console.error('Error parsing cross-tab connection data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

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
      // Check if this is a new tab connection (has connection attempt ID)
      const connectionAttemptId = localStorage.getItem('octra-dapp-connection-attempt');
      const savedProvider = localStorage.getItem('octra-dapp-selected-provider');
      
      if (connectionAttemptId) {
        // This is a new tab connection, signal to original tab
        const connectionData = {
          attemptId: connectionAttemptId,
          address: accountId,
          publicKey: publicKey,
          provider: savedProvider,
          timestamp: Date.now()
        };
        
        localStorage.setItem('octra-dapp-wallet-connected', JSON.stringify(connectionData));
        
        // Close this tab after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
        
        return; // Don't process connection in this tab
      }
      
      // This is the original tab, process normally
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
      const savedProviderFromStorage = localStorage.getItem('octra-dapp-selected-provider');
      if (savedProviderFromStorage) {
        setSelectedProvider(savedProviderFromStorage);
      }
      
      setIsConnecting(false);
      
      // Clean URL immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle transaction success
    if (txSuccess === 'true' && txHash) {
      console.log('Transaction success detected:', txHash);
      
      // Check if this is a new tab (has connection attempt or is different from main tab)
      const isNewTab = window.opener || document.referrer.includes('octra') || 
                      localStorage.getItem('octra-dapp-connection-attempt');
      
      if (isNewTab && window.opener) {
        // This is a new tab, signal to parent tab and close
        try {
          window.opener.postMessage({
            type: 'WALLET_TRANSACTION_SUCCESS',
            txHash: txHash
          }, window.location.origin);
        } catch (error) {
          console.error('Error posting message to parent:', error);
        }
        
        // Close this tab after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
        
        return; // Don't process in this tab
      }
      
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
      }, 500);
      
      // Clean URL immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle transaction error
    if (txError === 'true') {
      console.log('Transaction error detected');
      
      // Check if this is a new tab
      const isNewTab = window.opener || document.referrer.includes('octra');
      
      if (isNewTab && window.opener) {
        // Signal to parent tab and close
        try {
          window.opener.postMessage({
            type: 'WALLET_TRANSACTION_REJECTED'
          }, window.location.origin);
        } catch (error) {
          console.error('Error posting message to parent:', error);
        }
        
        setTimeout(() => {
          window.close();
        }, 1000);
        
        return;
      }
      
      setIsProcessingTransaction(false);
      clearPendingTransaction();
      
      // Reject pending transaction promise
      if (pendingTransactionReject) {
        pendingTransactionReject(new Error('Transaction failed or was cancelled'));
        setPendingTransactionResolve(null);
        setPendingTransactionReject(null);
      }
      
      // Clean URL
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
            const provider = providers.find((p: any) => {
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
        console.log('Received transaction success message from wallet tab:', txHash);
        
        // Check if this transaction was already processed
        if (isTransactionProcessed(txHash)) {
          console.log('Transaction already processed, skipping:', txHash);
          return;
        }
        
        // Mark as processed
        addProcessedTransaction(txHash);
        
        // Get pending transaction info
        const pendingTx = getPendingTransaction();
        
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
          detail: { txHash, pendingTransaction: pendingTx } 
        }));
        
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
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleMessage);
    };
  }, []); // Empty dependency array to run only once on mount

  const connectWallet = (providerUrl?: string) => {
    // Generate unique connection attempt ID
    const attemptId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setConnectionAttemptId(attemptId);
    localStorage.setItem('octra-dapp-connection-attempt', attemptId);
    
    setIsConnecting(true);
    
    // Use provided URL or get from providers list
    let walletUrl: string | undefined = providerUrl;
    if (!walletUrl) {
      const providers = getWalletProviders();
      walletUrl = providers[0]?.url || 'https://octra.xme.my.id';
    }
    
    // Save selected provider
    setSelectedProvider(walletUrl || null);
    if (walletUrl) {
      localStorage.setItem('octra-dapp-selected-provider', walletUrl);
    }
    
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

    // Open wallet in new tab instead of redirect
    const walletWindow = window.open(`${walletUrl}?${params.toString()}`, '_blank');
    setWalletWindow(walletWindow);
    
    // Monitor wallet window
    if (walletWindow) {
      const checkClosed = setInterval(() => {
        if (walletWindow.closed) {
          clearInterval(checkClosed);
          // Don't immediately set connecting to false, wait for cross-tab signal
          setTimeout(() => {
            // Only set to false if no connection was established
            const stillConnecting = localStorage.getItem('octra-dapp-connection-attempt');
            if (stillConnecting === attemptId) {
              setIsConnecting(false);
              localStorage.removeItem('octra-dapp-connection-attempt');
            }
          }, 2000);
          setWalletWindow(null);
        }
      }, 1000);
      
      // Set timeout to stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!walletWindow.closed) {
          setIsConnecting(false);
        }
      }, 300000);
    }
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
        
        // Redirect ke wallet untuk transaction
        // Open wallet in new tab for transaction confirmation
        const transactionWindow = window.open(`${walletUrl}?${params.toString()}`, '_blank');
        setWalletWindow(transactionWindow);
        
        // Monitor transaction window
        if (transactionWindow) {
          const checkClosed = setInterval(() => {
            if (transactionWindow.closed) {
              clearInterval(checkClosed);
              // Window closed, just clean up without error
              setIsProcessingTransaction(false);
              setWalletWindow(null);
            }
          }, 1000);
          
          // Stop checking after 5 minutes
          setTimeout(() => {
            clearInterval(checkClosed);
            setIsProcessingTransaction(false);
          }, 300000);
        }
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
    setConnectionAttemptId(null);
    localStorage.removeItem('octra-dapp-wallet');
    localStorage.removeItem('octra-dapp-selected-provider');
    localStorage.removeItem('octra-dapp-connection-attempt');
    localStorage.removeItem('octra-dapp-wallet-connected');
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