import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ExternalLink, Wallet } from 'lucide-react';

interface WalletProvider {
  name: string;
  url: string;
  description: string;
}

interface WalletProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider: (providerUrl: string) => void;
}

export function WalletProviderModal({ isOpen, onClose, onSelectProvider }: WalletProviderModalProps) {
  const getWalletProviders = (): WalletProvider[] => {
    const providersEnv = import.meta.env.VITE_WALLET_PROVIDERS || 'octra.xme.my.id,localhost:5173';
    const providerUrls = providersEnv.split(',').map(url => url.trim());
    
    return providerUrls.map(url => ({
      name: url.includes('localhost') ? 'Local Wallet' : 'Octra Web Wallet',
      url: url.startsWith('http') ? url : `https://${url}`,
      description: url.includes('localhost') 
        ? 'Development wallet running locally'
        : 'Official Octra Web Wallet'
    }));
  };

  const providers = getWalletProviders();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Select Wallet Provider</span>
          </DialogTitle>
          <DialogDescription>
            Choose a wallet provider to connect to ONS
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {providers.map((provider, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => {
                onSelectProvider(provider.url);
                onClose();
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Make sure you trust the wallet provider before connecting
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}