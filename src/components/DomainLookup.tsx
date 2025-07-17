import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Enter domain name (without .oct)"
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

        {/* Search Results */}
        {searchResult && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Domain Found
              </h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Domain
                </label>
                <div className="p-2 bg-green-100 dark:bg-green-800 rounded font-mono text-sm">
                  {searchResult.domain}.oct
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Resolves to
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 p-2 bg-green-100 dark:bg-green-800 rounded font-mono text-sm break-all">
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
              
              <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                <span>Registered: {new Date(searchResult.created_at).toLocaleDateString()}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openTransaction(searchResult.tx_hash)}
                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Transaction
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Not Found */}
        {notFound && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                Domain "{searchDomain}.oct" is not registered
              </span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              This domain is available for registration
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}