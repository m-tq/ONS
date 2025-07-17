import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function WalletConnection() {
  const { wallet, connectWallet, disconnectWallet, isConnecting } = useWallet();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  if (wallet.isConnected) {
    return (
      <div className="soft-card rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Wallet Connected
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                {truncateAddress(wallet.address!)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={disconnectWallet}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="soft-card rounded-xl p-8 mb-8">
      <div className="text-center">
        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
          Connect Your Octra Wallet
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Connect your Octra Web Wallet to interact with this DApp
        </p>
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          size="lg"
          className="px-8"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="h-5 w-5 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}