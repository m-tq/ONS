import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { resolverApi, DomainRecord, DomainStats } from '../services/resolverApi';
import { octraRpc, WalletBalance } from '../services/octraRpc';

export type DomainStatus = 'pending' | 'active' | 'deleting' | 'deleted';

export interface ExtendedDomainRecord extends DomainRecord {
  status: DomainStatus;
  last_verified?: string;
}

interface ONSContextType {
  userDomains: ExtendedDomainRecord[];
  globalStats: DomainStats | null;
  walletBalance: WalletBalance | null;
  isLoading: boolean;
  refreshUserDomains: () => Promise<void>;
  refreshGlobalStats: () => Promise<void>;
  refreshWalletBalance: () => Promise<void>;
  registerDomain: (domain: string, txHash: string) => Promise<boolean>;
  resolveDomain: (domain: string) => Promise<ExtendedDomainRecord | null>;
  checkDomainAvailability: (domain: string) => Promise<boolean>;
  verifyAndProcessTransaction: (txHash: string) => Promise<void>;
  setWalletAddressFromContext: (address: string | null) => void;
  verifyDomainStatus: (domain: ExtendedDomainRecord) => Promise<void>;
  deleteDomain: (domain: string) => Promise<string | null>;
  verifyDomainDeletion: (txHash: string) => Promise<void>;
}

const ONSContext = createContext<ONSContextType | undefined>(undefined);

export function useONS() {
  const context = useContext(ONSContext);
  if (context === undefined) {
    throw new Error('useONS must be used within an ONSProvider');
  }
  return context;
}

interface ONSProviderProps {
  children: ReactNode;
}

export function ONSProvider({ children }: ONSProviderProps) {
  const [userDomains, setUserDomains] = useState<ExtendedDomainRecord[]>([]);
  const [globalStats, setGlobalStats] = useState<DomainStats | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [processingTransactions, setProcessingTransactions] = useState<Set<string>>(new Set());

  // Listen for transaction success events from WalletContext
  useEffect(() => {
    const handleTransactionSuccess = async (event: CustomEvent) => {
      console.log('ONS Context: Received transaction success event:', event.detail);
      const { txHash, pendingTransaction } = event.detail;
      
      if (!txHash) {
        console.log('ONS Context: No txHash in event, skipping');
        return;
      }
      
      if (processingTransactions.has(txHash)) {
        console.log('ONS Context: Transaction already being processed:', txHash);
        return;
      }
      
      // Get wallet address from pending transaction if current wallet address is null
      let addressToUse = walletAddress;
      if (!addressToUse && pendingTransaction) {
        // Extract address from the transaction context or use a different approach
        console.log('ONS Context: Wallet address is null, checking for address in other ways');
        
        // Try to get address from localStorage as fallback
        try {
          const savedWallet = localStorage.getItem('octra-dapp-wallet');
          if (savedWallet) {
            const walletData = JSON.parse(savedWallet);
            addressToUse = walletData.address;
            console.log('ONS Context: Using address from localStorage:', addressToUse);
          }
        } catch (error) {
          console.error('ONS Context: Error getting address from localStorage:', error);
        }
      }
      
      if (!addressToUse) {
        console.log('ONS Context: No wallet address available, will retry when address is set');
        // Store the transaction hash to process later when wallet address becomes available
        localStorage.setItem('ons-pending-tx-processing', JSON.stringify({
          txHash,
          pendingTransaction,
          timestamp: Date.now()
        }));
        return;
      }
      
      console.log('ONS Context: Starting to process transaction:', txHash);
      
      // Mark as processing to prevent duplicate processing
      setProcessingTransactions(prev => new Set([...prev, txHash]));
      
      try {
        await verifyAndProcessTransaction(txHash, addressToUse);
        console.log('ONS Context: Transaction processed successfully:', txHash);
      } catch (error) {
        console.error('ONS Context: Error processing transaction:', error);
      } finally {
        // Remove from processing set
        setProcessingTransactions(prev => {
          const newSet = new Set(prev);
          newSet.delete(txHash);
          return newSet;
        });
        
        // Clear any pending transaction processing
        localStorage.removeItem('ons-pending-tx-processing');
      }
    };

    console.log('ONS Context: Adding transaction success event listener');
    window.addEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    
    return () => {
      console.log('ONS Context: Removing transaction success event listener');
      window.removeEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    };
  }, [walletAddress, processingTransactions]);

  // Method to set wallet address from WalletContext
  const setWalletAddressFromContext = (address: string | null) => {
    console.log('ONS Context: Setting wallet address:', address);
    setWalletAddress(address);
    
    // Check if there's a pending transaction to process now that we have an address
    if (address) {
      const pendingProcessing = localStorage.getItem('ons-pending-tx-processing');
      if (pendingProcessing) {
        try {
          const { txHash, pendingTransaction, timestamp } = JSON.parse(pendingProcessing);
          // Only process if not too old (5 minutes)
          if (Date.now() - timestamp < 300000) {
            console.log('ONS Context: Processing pending transaction now that address is available:', txHash);
            setTimeout(() => {
              verifyAndProcessTransaction(txHash, address);
            }, 1000); // Small delay to ensure everything is initialized
          } else {
            console.log('ONS Context: Pending transaction too old, skipping:', txHash);
          }
          localStorage.removeItem('ons-pending-tx-processing');
        } catch (error) {
          console.error('ONS Context: Error processing pending transaction:', error);
          localStorage.removeItem('ons-pending-tx-processing');
        }
      }
    }
  };

  const refreshUserDomains = async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) return;
    
    setIsLoading(true);
    try {
      // First get domains from database
      const dbDomains = await resolverApi.getDomainsByAddress(targetAddress);
      
      // Verify each domain on-chain
      const verifiedDomains = await Promise.all(
        dbDomains.map(async (domain) => {
          try {
            const isValid = await octraRpc.verifyDomainRegistration(
              domain.tx_hash, 
              domain.domain, 
              domain.address
            );
            return { ...domain, verified: isValid };
          } catch (error) {
            console.error(`Error verifying domain ${domain.domain}:`, error);
            return { ...domain, verified: false };
          }
        })
      );
      
      setUserDomains(verifiedDomains);
    } catch (error) {
      console.error('Error refreshing user domains:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshGlobalStats = async () => {
    try {
      const stats = await resolverApi.getGlobalStats();
      setGlobalStats(stats);
    } catch (error) {
      console.error('Error refreshing global stats:', error);
    }
  };

  const refreshWalletBalance = async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) return;
    
    try {
      const balance = await octraRpc.getWalletBalance(targetAddress);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error refreshing wallet balance:', error);
    }
  };

  const registerDomain = async (domain: string, txHash: string): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      // Verify transaction on-chain first
      const isValid = await octraRpc.verifyDomainRegistration(txHash, domain, walletAddress);
      if (!isValid) {
        return false;
      }

      // Register in off-chain resolver
      const result = await resolverApi.registerDomain(domain, walletAddress, txHash);
      if (result) {
        await refreshUserDomains();
        await refreshGlobalStats();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error registering domain:', error);
      return false;
    }
  };

  const verifyDomainStatus = async (domain: ExtendedDomainRecord) => {
    if (!domain.tx_hash) return;
    
    try {
      const tx = await octraRpc.getTransaction(domain.tx_hash);
      if (!tx) return;
      
      let newStatus: DomainStatus = domain.status;
      
      if (domain.status === 'pending' && tx.status === 'confirmed') {
        // Verify the transaction is valid for registration
        if (tx.parsed_tx.message?.startsWith('register_domain:')) {
          const domainFromTx = tx.parsed_tx.message.replace('register_domain:', '').replace('.oct', '');
          const isValid = await octraRpc.verifyDomainRegistration(domain.tx_hash, domainFromTx, domain.address);
          if (isValid) {
            newStatus = 'active';
          }
        }
      } else if (domain.status === 'deleting' && tx.status === 'confirmed') {
        newStatus = 'deleted';
      }
      
      if (newStatus !== domain.status) {
        await resolverApi.updateDomainStatus(domain.domain, newStatus);
        await refreshUserDomains();
        
        window.dispatchEvent(new CustomEvent('domainStatusUpdated', { 
          detail: { domain: `${domain.domain}.oct`, status: newStatus } 
        }));
      }
    } catch (error) {
      console.error('Error verifying domain status:', error);
    }
  };

  const deleteDomain = async (domain: string): Promise<string | null> => {
    if (!walletAddress) return null;
    
    try {
      // This would need to be implemented in WalletContext
      // For now, we'll return a mock transaction hash
      const txHash = await new Promise<string>((resolve, reject) => {
        // Dispatch event to WalletContext to send transaction
        window.dispatchEvent(new CustomEvent('sendTransaction', {
          detail: {
            to: octraRpc.getMasterWallet(),
            amount: '0.1', // Deletion fee
            message: `delete_domain:${domain}.oct`,
            resolve,
            reject
          }
        }));
      });
      
      return txHash;
    } catch (error) {
      console.error('Error deleting domain:', error);
      return null;
    }
  };

  const verifyDomainDeletion = async (txHash: string) => {
    await verifyAndProcessTransaction(txHash);
  };

  const resolveDomain = async (domain: string): Promise<ExtendedDomainRecord | null> => {
    try {
      const result = await resolverApi.resolveDomain(domain);
      if (result) {
        return {
          ...result,
          status: (result as any).status || 'active'
        };
      }
      return null;
    } catch (error) {
      console.error('Error resolving domain:', error);
      return null;
    }
  };

  const verifyAndProcessTransaction = async (txHash: string, addressToUse?: string) => {
    const targetAddress = addressToUse || walletAddress;
    if (!targetAddress) {
      console.error('ONS Context: No wallet address available for transaction processing');
      return;
    }

    console.log('ONS Context: Verifying transaction:', txHash, 'for address:', targetAddress);

    try {
      // Get transaction details
      const tx = await octraRpc.getTransaction(txHash);
      if (!tx) {
        console.error('ONS Context: Transaction not found:', tx);
        return;
      }

      console.log('ONS Context: Transaction details:', tx);

      // Check if it's a domain registration transaction
      const message = tx.parsed_tx.message;
      if (message && message.startsWith('register_domain:') && message.endsWith('.oct')) {
        const domain = message.replace('register_domain:', '').replace('.oct', '');
        
        console.log('ONS Context: Processing domain registration for:', domain);
        
        // Determine status based on transaction status
        const status = tx.status === 'confirmed' ? 'active' : 'pending';
        console.log('ONS Context: Domain status will be:', status);
        
        // For confirmed transactions, verify the details
        if (tx.status === 'confirmed') {
          const isValid = await octraRpc.verifyDomainRegistration(txHash, domain, targetAddress);
          console.log('ONS Context: Transaction verification result:', isValid);
          
          if (!isValid) {
            console.error('ONS Context: Transaction verification failed');
            return;
          }
        }
        
        // Register in off-chain resolver (for both pending and confirmed)
        const result = await resolverApi.registerDomain(domain, targetAddress, txHash, status);
        console.log('ONS Context: Domain registration result:', result);
        
        if (result) {
          // Refresh user domains and stats
          await refreshUserDomains(targetAddress);
          await refreshGlobalStats();
          await refreshWalletBalance(targetAddress);
          
          // Show success notification
          window.dispatchEvent(new CustomEvent('domainRegistered', { 
            detail: { domain: `${domain}.oct`, txHash, status } 
          }));
          
          console.log(`ONS Context: Domain ${domain}.oct registered successfully with status: ${status}`);
        } else {
          console.error('ONS Context: Failed to register domain in resolver API');
        }
      } else if (message && message.startsWith('delete_domain:') && message.endsWith('.oct')) {
        // Handle domain deletion
        const domain = message.replace('delete_domain:', '').replace('.oct', '');
        console.log('ONS Context: Processing domain deletion for:', domain);
        
        const status = tx.status === 'confirmed' ? 'deleted' : 'deleting';
        
        // Update domain status
        const result = await resolverApi.updateDomainStatus(domain, status);
        if (result) {
          await refreshUserDomains(targetAddress);
          await refreshGlobalStats();
          
          if (tx.status === 'confirmed') {
            window.dispatchEvent(new CustomEvent('domainDeleted', { 
              detail: { domain: `${domain}.oct`, txHash } 
            }));
          } else {
            window.dispatchEvent(new CustomEvent('domainDeleting', { 
              detail: { domain: `${domain}.oct`, txHash } 
            }));
          }
        }
      } else {
        console.log('ONS Context: Not a domain-related transaction:', message);
      }
    } catch (error) {
      console.error('ONS Context: Error processing transaction:', error);
    }
  };

  const checkDomainAvailability = async (domain: string): Promise<boolean> => {
    try {
      return await resolverApi.checkDomainAvailability(domain);
    } catch (error) {
      console.error('Error checking domain availability:', error);
      return false;
    }
  };

  // Expose method to set wallet address
  useEffect(() => {
    if (walletAddress) {
      refreshUserDomains(walletAddress);
      refreshWalletBalance(walletAddress);
    }
  }, [walletAddress]);

  // Load global stats on mount
  useEffect(() => {
    refreshGlobalStats();
  }, []);

  return (
    <ONSContext.Provider value={{
      userDomains,
      globalStats,
      walletBalance,
      isLoading,
      refreshUserDomains,
      refreshGlobalStats,
      refreshWalletBalance,
      registerDomain,
      resolveDomain,
      checkDomainAvailability,
      verifyAndProcessTransaction,
      setWalletAddressFromContext,
      verifyDomainStatus,
      deleteDomain,
      verifyDomainDeletion
    }}>
      {children}
    </ONSContext.Provider>
  );
}