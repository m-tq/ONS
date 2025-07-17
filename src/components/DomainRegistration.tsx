import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useONS } from '../contexts/ONSContext';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../hooks/use-toast';
import { isValidDomain } from '../lib/utils';
import { Search, CheckCircle, XCircle, ExternalLink, Loader2, Send } from 'lucide-react';
import { octraRpc } from '../services/octraRpc';

export function DomainRegistration() {
  const [domain, setDomain] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { checkDomainAvailability, registerDomain, walletBalance } = useONS();
  const { wallet, sendTransaction } = useWallet();
  const { toast } = useToast();

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
        // Register domain with the transaction hash
        const success = await registerDomain(domain, txHash);
        
        if (success) {
          toast({
            title: "Registration Successful!",
            description: `${domain}.oct has been registered successfully`,
          });
          setDomain('');
          setIsAvailable(null);
        } else {
          toast({
            title: "Registration Failed",
            description: "Failed to register domain. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Transaction was cancelled or failed",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const hasInsufficientBalance = walletBalance && parseFloat(walletBalance.balance) < 0.5;

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" />
          <span>Register Domain</span>
        </CardTitle>
        <CardDescription>
          Register your Octra address as a human-readable domain name
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Warning */}
        {hasInsufficientBalance && (
          <div className="p-4 bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200/60 dark:border-yellow-800/60 rounded-lg backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Insufficient Balance</span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              You need at least 0.5 OCT to register a domain. Current balance: {walletBalance?.balance} OCT
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.open(octraRpc.getFaucetUrl(), '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Get OCT from Faucet
            </Button>
          </div>
        )}

        {/* Domain Search */}
        <div className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Enter domain name (without .oct)"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setIsAvailable(null);
                }}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400">
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

          {/* Availability Status */}
          {isAvailable !== null && (
            <div className={`p-3 rounded-lg flex items-center space-x-2 backdrop-blur-sm ${
              isAvailable 
                ? 'bg-green-50/80 dark:bg-green-900/20 border border-green-200/60 dark:border-green-800/60' 
                : 'bg-red-50/80 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/60'
            }`}>
              {isAvailable ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {domain}.oct is available!
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-300 font-medium">
                    {domain}.oct is already taken
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Registration Form */}
        {isAvailable && wallet.isConnected && (
          <div className="space-y-4 p-4 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/60 rounded-lg backdrop-blur-sm">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              Register Domain
            </h4>
            
            <div className="space-y-2">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Registration fee: <strong>0.5 OCT</strong>
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Domain: <strong>{domain}.oct</strong>
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Will be registered to: <code className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded text-xs">
                  {wallet.address}
                </code>
              </p>
            </div>

            <Button 
              onClick={handleRegisterWithWallet}
              disabled={isRegistering || hasInsufficientBalance}
              className="w-full"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Register Domain (0.5 OCT)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Connect Wallet Prompt */}
        {isAvailable && !wallet.isConnected && (
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-lg backdrop-blur-sm">
            <p className="text-slate-700 dark:text-slate-300 text-center">
              Please connect your wallet to register this domain
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}