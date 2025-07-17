import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from './WalletContext';
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
  const { wallet } = useWallet();
  const [userDomains, setUserDomains] = useState<DomainRecord[]>([]);
  const [globalStats, setGlobalStats] = useState<DomainStats | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshUserDomains = async () => {
    if (!wallet.address) return;
    
    setIsLoading(true);
    try {
      const domains = await resolverApi.getDomainsByAddress(wallet.address);
      setUserDomains(domains);
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

  const refreshWalletBalance = async () => {
    if (!wallet.address) return;
    
    try {
      const balance = await octraRpc.getWalletBalance(wallet.address);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error refreshing wallet balance:', error);
    }
  };

  const registerDomain = async (domain: string, txHash: string): Promise<boolean> => {
    if (!wallet.address) return false;

    try {
      // Verify transaction on-chain first
      const isValid = await octraRpc.verifyDomainRegistration(txHash, domain, wallet.address);
      if (!isValid) {
        return false;
      }

      // Register in off-chain resolver
      const result = await resolverApi.registerDomain(domain, wallet.address, txHash);
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

  const checkDomainAvailability = async (domain: string): Promise<boolean> => {
    try {
      return await resolverApi.checkDomainAvailability(domain);
    } catch (error) {
      console.error('Error checking domain availability:', error);
      return false;
    }
  };

  // Load data when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refreshUserDomains();
      refreshWalletBalance();
    }
  }, [wallet.isConnected, wallet.address]);

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
    }}>
      {children}
    </ONSContext.Provider>
  );
}