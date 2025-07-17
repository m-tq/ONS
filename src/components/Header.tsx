import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  Wallet, 
  LogOut, 
  Sun, 
  Moon, 
  User, 
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { truncateAddress } from '../lib/utils';
import { useToast } from '../hooks/use-toast';

export function Header() {
  const { wallet, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const copyAddress = async () => {
    if (wallet.address) {
      try {
        await navigator.clipboard.writeText(wallet.address);
        toast({
          title: "Address Copied",
          description: "Wallet address copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy address to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const openExplorer = () => {
    if (wallet.address) {
      window.open(`https://octra.network/address/${wallet.address}`, '_blank');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              O
            </div>
            <span className="text-xl font-bold">ONS</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Octra Name Service
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                aria-label="Toggle theme"
              />
              <Moon className="h-4 w-4" />
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Wallet Connection */}
            {wallet.isConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Wallet Connected</p>
                      <p className="text-xs leading-none text-muted-foreground font-mono">
                        {truncateAddress(wallet.address!)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={copyAddress}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Address</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openExplorer}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>View on Explorer</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet} className="text-red-600 dark:text-red-400">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Disconnect</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                variant="default"
                size="sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}