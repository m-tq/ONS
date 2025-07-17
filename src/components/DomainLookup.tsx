import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useONS } from '../contexts/ONSContext';
import { useToast } from '../hooks/use-toast';
import { DomainRecord } from '../services/resolverApi';
import { Search, Copy, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { truncateAddress } from '../lib/utils';

export function DomainLookup() {
  const [searchDomain, setSearchDomain] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<DomainRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { resolveDomain } = useONS();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchDomain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name to search",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setNotFound(false);

    try {
      const result = await resolveDomain(searchDomain);
      
      if (result) {
        setSearchResult(result);
        toast({
          title: "Domain Found!",
          description: `${searchDomain}.oct resolves to ${truncateAddress(result.address)}`,
        });
      } else {
        setNotFound(true);
        toast({
          title: "Domain Not Found",
          description: `${searchDomain}.oct is not registered`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Failed to search for domain",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const openTransaction = (txHash: string) => {
    window.open(`https://octra.network/tx/${txHash}`, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" />
          <span>Domain Lookup</span>
        </CardTitle>
        <CardDescription>
          Search for any ONS domain to find its associated Octra address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Form */}
        <div className="space-y-2">
          <Label htmlFor="search">Domain Name</Label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                id="search"
                placeholder="Enter domain name"
                value={searchDomain}
                onChange={(e) => {
                  setSearchDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setSearchResult(null);
                  setNotFound(false);
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                .oct
              </span>
            </div>
            <Button 
              onClick={handleSearch}
              disabled={isSearching || !searchDomain.trim()}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {searchResult && (
          <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                <span>Domain Found</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Domain</Label>
                  <p className="font-mono bg-background p-2 rounded mt-1">
                    {searchResult.domain}.oct
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Registered</Label>
                  <p className="font-medium mt-1">
                    {new Date(searchResult.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Resolves to</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 font-mono bg-background p-2 rounded text-sm break-all">
                    {searchResult.address}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(searchResult.address)}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openTransaction(searchResult.tx_hash)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Transaction
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Found */}
        {notFound && (
          <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
                <Search className="h-5 w-5" />
                <span className="font-medium">
                  Domain "{searchDomain}.oct" is not registered
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                This domain is available for registration
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}