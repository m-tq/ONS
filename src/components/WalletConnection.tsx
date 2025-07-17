import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export function WalletConnection() {
  const { wallet, connectWallet, disconnectWallet, isConnecting } = useWallet();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  if (wallet.isConnected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Wallet Connected
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                {truncateAddress(wallet.address!)}
              </p>
            </div>
          </div>
          <button
            onClick={disconnectWallet}
            className="flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
      <div className="text-center">
        <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Connect Your Octra Wallet
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Connect your Octra Web Wallet to interact with this DApp
        </p>
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet className="h-5 w-5" />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}