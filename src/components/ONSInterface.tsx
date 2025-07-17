import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { DomainRegistration } from './DomainRegistration';
import { DomainLookup } from './DomainLookup';
import { UserDomains } from './UserDomains';
import { GlobalStats } from './GlobalStats';
import { useWallet } from '../contexts/WalletContext';
import { useONS } from '../contexts/ONSContext';
import { formatOCT } from '../lib/utils';
import { Coins, Globe, Search, BarChart3, User } from 'lucide-react';

export function ONSInterface() {
  const { wallet } = useWallet();
  const { walletBalance } = useONS();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Transform Your Octra Address
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Convert your long Octra address into a human-readable domain name with ONS
        </p>
      </div>

      {/* Wallet Balance Card */}
      {wallet.isConnected && walletBalance && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Coins className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Wallet Balance</p>
                  <p className="text-sm text-muted-foreground">
                    Available for domain registration
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatOCT(walletBalance.balance)} OCT
                </p>
                <p className="text-sm text-muted-foreground">
                  ≈ {Math.floor(parseFloat(walletBalance.balance) / 0.5)} domains
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Interface */}
      <Tabs defaultValue="register" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="register" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Register</span>
          </TabsTrigger>
          <TabsTrigger value="lookup" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Lookup</span>
          </TabsTrigger>
          <TabsTrigger value="domains" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>My Domains</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Statistics</span>
          </TabsTrigger>
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