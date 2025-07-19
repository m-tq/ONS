import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useONS } from '../contexts/ONSContext';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../hooks/use-toast';
import { isValidDomain } from '../lib/utils';
import { Search, CheckCircle, XCircle, ExternalLink, Loader2, Send, AlertTriangle } from 'lucide-react';
import { octraRpc } from '../services/octraRpc';

export function DomainRegistration() {
  const [domain, setDomain] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { checkDomainAvailability, registerDomain, walletBalance } = useONS();
  const { wallet, sendTransaction, isProcessingTransaction } = useWallet();
  const { toast } = useToast();

  // Listen for domain registration success
  useEffect(() => {
    const handleDomainRegistered = (event: CustomEvent) => {
      console.log('DomainRegistration: Domain registered event received:', event.detail);
      const { domain: registeredDomain } = event.detail;
      toast({
        title: "Registration Successful!",
        description: `${registeredDomain} has been registered successfully`,
      });
      
      // Reset form
      setDomain('');
      setIsAvailable(null);
      setIsRegistering(false);
    };

    const handleTransactionSuccess = (event: CustomEvent) => {
      console.log('DomainRegistration: Transaction success event received:', event.detail);
      // Reset registration state when transaction succeeds
      setIsRegistering(false);
    };
    window.addEventListener('domainRegistered', handleDomainRegistered as EventListener);
    window.addEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    
    return () => {
      window.removeEventListener('domainRegistered', handleDomainRegistered as EventListener);
      window.removeEventListener('transactionSuccess', handleTransactionSuccess as EventListener);
    };
  }, [toast]);

  const handleCheckAvailability = async () => {
    if (!domain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    if (!isValidDomain(domain)) {
      toast({
        title: "Invalid Domain",
        description: "Domain must be 3-63 characters long and contain only letters, numbers, and hyphens",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      const available = await checkDomainAvailability(domain);
      setIsAvailable(available);
      
      if (available) {
        toast({
          title: "Domain Available!",
          description: `${domain}.oct is available for registration`,
        });
      } else {
        toast({
          title: "Domain Taken",
          description: `${domain}.oct is already registered`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check domain availability",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleRegisterWithWallet = async () => {
    if (!wallet.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!isAvailable) {
      toast({
        title: "Domain Not Available",
        description: "Please check domain availability first",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    try {
      // Send transaction through wallet
      const txHash = await sendTransaction(
        octraRpc.getMasterWallet(),
        '0.5',
        `register_domain:${domain}.oct`
      );

      if (txHash) {
        toast({
          title: "Transaction Sent!",
          description: `Transaction sent successfully. You will be redirected to complete the registration.`,
        });
        
        // Don't reset form here, wait for success callback
        console.log('Transaction sent, hash:', txHash);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Transaction was cancelled or failed",
        variant: "destructive",
      });
      setIsRegistering(false);
    } finally {
      // Don't set isRegistering to false here, wait for callback
    }
  };

  const hasInsufficientBalance = walletBalance && parseFloat(walletBalance.balance) < 0.5;
  const isProcessing = isRegistering || isProcessingTransaction;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Register Domain</span>
          </CardTitle>
          <CardDescription>
            Register your Octra address as a human-readable domain name for 0.5 OCT
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Warning */}
          {hasInsufficientBalance && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Insufficient Balance</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  You need at least 0.5 OCT to register a domain. Current balance: {walletBalance?.balance} OCT
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.open(octraRpc.getFaucetUrl(), '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Get OCT from Faucet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Domain Search */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Input
                    id="domain"
                    placeholder="Enter domain name"
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setIsAvailable(null);
                    }}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    .oct
                  </span>
                </div>
                <Button 
                  onClick={handleCheckAvailability}
                  disabled={isChecking || !domain.trim()}
                  variant="outline"
                >
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Availability Status */}
            {isAvailable !== null && (
              <Card className={isAvailable ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/50' : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/50'}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    {isAvailable ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-700 dark:text-green-300">
                          {domain}.oct is available!
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <span className="font-medium text-red-700 dark:text-red-300">
                          {domain}.oct is already taken
                        </span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Registration Form */}
          {isAvailable && wallet.isConnected && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Complete Registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Domain</Label>
                    <p className="font-medium">{domain}.oct</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Registration Fee</Label>
                    <p className="font-medium">0.5 OCT</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Will be registered to</Label>
                    <p className="font-mono text-xs bg-muted p-2 rounded mt-1">
                      {wallet.address}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleRegisterWithWallet}
                  disabled={isProcessing || hasInsufficientBalance}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isProcessingTransaction ? 'Processing Transaction...' : 'Preparing Registration...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Register Domain (0.5 OCT)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Connect Wallet Prompt */}
          {isAvailable && !wallet.isConnected && (
            <Card className="border-muted">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  Please connect your wallet to register this domain
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}