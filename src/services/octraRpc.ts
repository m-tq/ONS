export interface OctraTransaction {
  parsed_tx: {
    from: string;
    to: string;
    amount: string;
    amount_raw: string;
    nonce: number;
    ou: string;
    timestamp: number;
    message: string;
  };
  status: string;
  epoch: number;
  tx_hash: string;
  data: string;
  source: string;
}

export interface WalletBalance {
  balance: string;
  balance_raw: string;
}

export class OctraRpcService {
  private baseUrl: string;
  private masterWallet: string;
  private faucetUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_OCTRA_RPC_URL || 'http://localhost:5173/api/octra';
    this.masterWallet = import.meta.env.VITE_MASTER_WALLET || 'oct8UYokvM1DR2QpTD4mncgvRzfM6f9yDuRR1gmBASgTk8d';
    this.faucetUrl = import.meta.env.VITE_OCTRA_FAUCET_URL || 'https://oct-faucet.xme.my.id';
  }

  async getTransaction(txHash: string): Promise<OctraTransaction | null> {
    try {
      console.log('Fetching transaction:', txHash);
      const response = await fetch(`${this.baseUrl}/tx/${txHash}`);
      if (!response.ok) {
        console.error('Transaction fetch failed:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Transaction data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }

  async getWalletBalance(address: string): Promise<WalletBalance | null> {
    try {
      const response = await fetch(`${this.baseUrl}/balance/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching balance:', error);
      return null;
    }
  }

  async getWalletTransactions(address: string, limit = 50): Promise<OctraTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${address}?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.transactions || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async verifyDomainRegistration(txHash: string, domain: string, fromAddress: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txHash);
      if (!tx) return false;

      // Verify transaction details
      const isValidTx = 
        tx.status === 'confirmed' &&
        tx.parsed_tx.to === this.masterWallet &&
        tx.parsed_tx.from === fromAddress &&
        parseFloat(tx.parsed_tx.amount) >= 0.5 &&
        tx.parsed_tx.message === `register_domain:${domain}.oct`;

      return isValidTx;
    } catch (error) {
      console.error('Error verifying domain registration:', error);
      return false;
    }
  }

  getMasterWallet(): string {
    return this.masterWallet;
  }

  getFaucetUrl(): string {
    return this.faucetUrl;
  }
}

export const octraRpc = new OctraRpcService();