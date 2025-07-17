import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DomainRegistration } from './DomainRegistration';
import { DomainLookup } from './DomainLookup';
import { UserDomains } from './UserDomains';
import { GlobalStats } from './GlobalStats';
import { useWallet } from '../contexts/WalletContext';
import { useONS } from '../contexts/ONSContext';
import { formatOCT } from '../lib/utils';
import { Wallet, Coins } from 'lucide-react';

export function ONSInterface() {
  const { wallet } = useWallet();
  const { walletBalance } = useONS();

  return (
    <div className="space-y-6">
      {/* Wallet Status */}
      {wallet.isConnected && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Wallet Connected
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-mono">
                  {wallet.address}
                </p>
              </div>
            </div>
            {walletBalance && (
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                <Coins className="h-4 w-4" />
                <span className="font-medium">
                  {formatOCT(walletBalance.balance)} OCT
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Interface */}
      <Tabs defaultValue="register" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="lookup">Lookup</TabsTrigger>
          <TabsTrigger value="domains">My Domains</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="space-y-6">
          <DomainRegistration />
        </TabsContent>

        <TabsContent value="lookup" className="space-y-6">
          <DomainLookup />
        </TabsContent>

        <TabsContent value="domains" className="space-y-6">
          <UserDomains />
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <GlobalStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}