import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Send, Eye, Copy, CheckCircle } from 'lucide-react';

export function DAppInterface() {
  const { wallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Connect your wallet to access DApp features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Wallet Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono break-all">
                {wallet.address}
              </code>
              <button
                onClick={() => copyToClipboard(wallet.address!)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          
          {wallet.publicKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Public Key
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono break-all">
                  {wallet.publicKey}
                </code>
                <button
                  onClick={() => copyToClipboard(wallet.publicKey!)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Copy public key"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DApp Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          DApp Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">View Balance</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Check your OCT balance directly from the DApp
            </p>
            <button className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg transition-colors">
              View Balance
            </button>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <Send className="h-5 w-5 text-green-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">Send Transaction</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Send OCT tokens through the connected wallet
            </p>
            <button className="w-full px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded-lg transition-colors">
              Send OCT
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-green-700 dark:text-green-300 font-medium">
            Successfully connected to Octra Web Wallet
          </span>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
          You can now interact with the Octra blockchain through this DApp
        </p>
      </div>
    </div>
  );
}