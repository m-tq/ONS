import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useONS } from '../contexts/ONSContext';
import { useWallet } from '../contexts/WalletContext';
import { Globe, Copy, ExternalLink, CheckCircle, RefreshCw, User } from 'lucide-react';
import { truncateAddress } from '../lib/utils';
import { useToast } from '../hooks/use-toast';

export function UserDomains() {
  const { wallet } = useWallet();
  const { userDomains, isLoading, refreshUserDomains } = useONS();
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Domain copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy domain to clipboard",
        variant: "destructive",
      });
    }
  };

  const openTransaction = (txHash: string) => {
    window.open(`https://octra.network/tx/${txHash}`, '_blank');
  };

  if (!wallet.isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>My Domains</span>
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your registered domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Connect your wallet to see your domains</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>My Domains</span>
            </CardTitle>
            <CardDescription>
              Domains registered to {truncateAddress(wallet.address!)}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshUserDomains}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading your domains...</p>
          </div>
        ) : userDomains.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No domains registered yet</p>
            <p className="text-sm">Register your first domain to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userDomains.map((domain) => (
              <Card key={domain.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{domain.domain}.oct</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          {domain.verified && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                          <span>
                            {domain.verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${domain.domain}.oct`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTransaction(domain.tx_hash)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Resolves to: </span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {truncateAddress(domain.address)}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registered: </span>
                      <span>{new Date(domain.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}