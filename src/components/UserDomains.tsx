import React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useONS } from '../contexts/ONSContext';
import { useWallet } from '../contexts/WalletContext';
import { Globe, Copy, ExternalLink, CheckCircle, RefreshCw, User, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { truncateAddress } from '../lib/utils';
import { useToast } from '../hooks/use-toast';
import type { ExtendedDomainRecord } from '../contexts/ONSContext';

export function UserDomains() {
  const { wallet } = useWallet();
  const { userDomains, isLoading, refreshUserDomains, verifyDomainStatus, verifyDomainDeletion } = useONS();
  const { sendTransaction } = useWallet();
  const { toast } = useToast();
  const [verifyingDomains, setVerifyingDomains] = useState<Set<number>>(new Set());
  const [deletingDomains, setDeletingDomains] = useState<Set<number>>(new Set());
  const [verifyingDeletion, setVerifyingDeletion] = useState<Set<number>>(new Set());

  const getExplorerUrl = () => {
    return import.meta.env.VITE_EXPLORER_URL || 'https://octrascan.io';
  };

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
    window.open(`${getExplorerUrl()}/tx/${txHash}`, '_blank');
  };

  const handleVerifyDomain = async (domain: ExtendedDomainRecord) => {
    if (!wallet.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to verify domain",
        variant: "destructive",
      });
      return;
    }

    setVerifyingDomains(prev => new Set([...prev, domain.id]));
    try {
      console.log('UserDomains: Verifying domain:', domain);
      await verifyDomainStatus(domain);
      toast({
        title: "Verification Complete",
        description: `Domain ${domain.domain}.oct has been verified`,
      });
      // Refresh domains after verification
      await refreshUserDomains();
    } catch (error) {
      console.error('UserDomains: Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify domain status",
        variant: "destructive",
      });
    } finally {
      setVerifyingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domain.id);
        return newSet;
      });
    }
  };

  const handleDeleteDomain = async (domain: ExtendedDomainRecord) => {
    setDeletingDomains(prev => new Set([...prev, domain.id]));
    
    try {
      // Send deletion transaction directly using wallet context
      const txHash = await sendTransaction(
        'oct8UYokvM1DR2QpTD4mncgvRzfM6f9yDuRR1gmBASgTk8d', // Master wallet
        '0.1', // Deletion fee
        `delete_domain:${domain.domain}.oct`
      );
      
      if (txHash) {
        console.log('UserDomains: Deletion transaction sent:', txHash);
        toast({
          title: "Deletion Initiated",
          description: `Domain deletion transaction sent. Please confirm in wallet.`,
        });
        
        // Immediately update domain status to 'deleting' in local state
        const updatedDomains = userDomains.map(d => 
          d.id === domain.id ? { ...d, status: 'deleting' as DomainStatus } : d
        );
        // This would need to be exposed from ONS context, for now we'll rely on the transaction processing
      } else {
        throw new Error('Failed to send deletion transaction');
      }
    } catch (error) {
      console.error('UserDomains: Deletion error:', error);
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete domain",
        variant: "destructive",
      });
      setDeletingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domain.id);
        return newSet;
      });
    }
  };

  const handleVerifyDeletion = async (domain: ExtendedDomainRecord) => {
    if (!domain.tx_hash) {
      toast({
        title: "No Transaction Hash",
        description: "No deletion transaction hash found for this domain",
        variant: "destructive",
      });
      return;
    }

    setVerifyingDeletion(prev => new Set([...prev, domain.id]));
    try {
      console.log('UserDomains: Verifying deletion for domain:', domain.domain, 'with hash:', domain.tx_hash);
      const success = await verifyDomainDeletion(domain.domain, domain.tx_hash);
      
      if (success) {
        toast({
          title: "Deletion Verified",
          description: `Domain ${domain.domain}.oct deletion has been verified`,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Failed to verify domain deletion. The transaction may still be pending.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('UserDomains: Deletion verification error:', error);
      toast({
        title: "Verification Error",
        description: "An error occurred while verifying deletion",
        variant: "destructive",
      });
    } finally {
      setVerifyingDeletion(prev => {
        const newSet = new Set(prev);
        newSet.delete(domain.id);
        return newSet;
      });
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'deleting':
        return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      case 'deleted':
        return <Trash2 className="h-3 w-3 text-red-500" />;
      default:
        return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending Confirmation';
      case 'deleting':
        return 'Deletion Pending';
      case 'deleted':
        return 'Deleted';
      default:
        return 'Active';
    }
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
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('UserDomains: Manual refresh triggered');
                refreshUserDomains();
              }}
              disabled={isLoading}
              title="Refresh domains list"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
                          {getStatusIcon(domain.status || 'active')}
                          <span>
                            {getStatusText(domain.status || 'active')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(domain.status === 'pending' || domain.status === 'deleting') && (
                        <Button
                          variant={domain.status === 'pending' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => handleVerifyDomain(domain)}
                          disabled={verifyingDomains.has(domain.id)}
                          className={domain.status === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600 text-white animate-pulse' : ''}
                        >
                          {verifyingDomains.has(domain.id) ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify
                            </>
                          )}
                        </Button>
                      )}
                      {domain.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDomain(domain)}
                          disabled={deletingDomains.has(domain.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete domain"
                        >
                          {deletingDomains.has(domain.id) ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {(domain.status === 'deleting' || domain.status === 'deleted') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyDeletion(domain)}
                          disabled={verifyingDeletion.has(domain.id)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          {verifyingDeletion.has(domain.id) ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify Deletion
                            </>
                          )}
                        </Button>
                      )}
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
                    {domain.status === 'pending' && (
                      <div className="text-yellow-600 dark:text-yellow-400 text-xs">
                        ⏳ Waiting for blockchain confirmation (2-3 minutes) - Click "Verify" to check status
                      </div>
                    )}
                    {domain.status === 'deleting' && (
                      <div className="text-orange-600 dark:text-orange-400 text-xs">
                        🗑️ Deletion pending confirmation (2-3 minutes) - Click "Verify Deletion" with transaction hash
                      </div>
                    )}
                    {domain.status === 'deleted' && (
                      <div className="text-red-600 dark:text-red-400 text-xs">
                        ❌ Domain has been deleted - Click "Verify Deletion" to update with latest transaction
                      </div>
                    )}
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