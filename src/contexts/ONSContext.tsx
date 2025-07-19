import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { resolverApi, DomainRecord, DomainStats } from '../services/resolverApi';
import { octraRpc, WalletBalance } from '../services/octraRpc';

interface ONSContextType {
  userDomains: DomainRecord[];
  globalStats: DomainStats | null;
  walletBalance: WalletBalance | null;
  isLoading: boolean;
  refreshUserDomains: () => Promise<void>;
  refreshGlobalStats: () => Promise<void>;
  refreshWalletBalance: () => Promise<void>;
  registerDomain: (domain: string, txHash: string) => Promise<boolean>;
  resolveDomain: (domain: string) => Promise<DomainRecord | null>;
  checkDomainAvailability: (domain: string) => Promise<boolean>;
  verifyAndProcessTransaction: (txHash: string) => Promise<void>;
  setWalletAddressFromContext: (address: string | null) => void;
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
  const [userDomains, setUserDomains] = useState<DomainRecord[]>([]);
  const [globalStats, setGlobalStats] = useState<DomainStats | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Listen for transaction success events from WalletContext
  useEffect(() => {
    const handleTransactionSuccess = async (event: CustomEvent) => {
      const { txHash } = event.detail;
      if (txHash) {
        await verifyAndProcessTransaction(txHash);
      }
    };

    window.addEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    
    return () => {
      window.removeEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    };
  }, [walletAddress]);

  // Method to set wallet address from WalletContext
  const setWalletAddressFromContext = (address: string | null) => {
    setWalletAddress(address);
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

  const resolveDomain = async (domain: string): Promise<DomainRecord | null> => {
    try {
      return await resolverApi.resolveDomain(domain);
    } catch (error) {
      console.error('Error resolving domain:', error);
      return null;
    }
  };

  const verifyAndProcessTransaction = async (txHash: string) => {
    if (!walletAddress) return;

    try {
      // Get transaction details
      const tx = await octraRpc.getTransaction(txHash);
      if (!tx || tx.status !== 'confirmed') {
        console.error('Transaction not found or not confirmed');
        return;
      }

      // Check if it's a domain registration transaction
      const message = tx.parsed_tx.message;
      if (message && message.startsWith('register_domain:') && message.endsWith('.oct')) {
        const domain = message.replace('register_domain:', '').replace('.oct', '');
        
        // Verify the transaction details
        const isValid = await octraRpc.verifyDomainRegistration(txHash, domain, walletAddress);
        if (isValid) {
          // Register in off-chain resolver
          const result = await resolverApi.registerDomain(domain, walletAddress, txHash);
          
          if (result) {
            // Refresh user domains and stats
            await refreshUserDomains();
            await refreshGlobalStats();
            await refreshWalletBalance();
            
            // Show success notification
            window.dispatchEvent(new CustomEvent('domainRegistered', { 
              detail: { domain: `${domain}.oct`, txHash } 
            }));
            
            console.log(`Domain ${domain}.oct registered successfully`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
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
      setWalletAddressFromContext
    }}>
      {children}
    </ONSContext.Provider>
  );
}