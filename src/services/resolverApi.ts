export interface DomainRecord {
  id: number;
  domain: string;
  address: string;
  tx_hash: string;
  created_at: string;
  verified: boolean;
  status?: 'pending' | 'active' | 'deleting' | 'deleted';
  last_verified?: string;
}

export interface DomainStats {
  total_domains: number;
  total_users: number;
  recent_registrations: number;
}

export class ResolverApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_RESOLVER_API_URL || 'http://localhost:3001/api';
  }

  async registerDomain(domain: string, address: string, txHash: string, status: string = 'active'): Promise<DomainRecord | null> {
    try {
      console.log('ResolverAPI: Registering domain:', { domain, address, txHash });
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          address,
          tx_hash: txHash,
          status,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ResolverAPI: Registration failed:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('ResolverAPI: Registration successful:', result);
      return result;
    } catch (error) {
      console.error('ResolverAPI: Error registering domain:', error);
      return null;
    }
  }

  async updateDomainStatus(domain: string, status: string, deletionTxHash?: string): Promise<boolean> {
    try {
      const body: any = { status };
      if (deletionTxHash) {
        body.deletion_tx_hash = deletionTxHash;
      }

      const response = await fetch(`${this.baseUrl}/domains/${domain}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating domain status:', error);
      return false;
    }
  }

  async getDomainsByAddress(address: string): Promise<DomainRecord[]> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/address/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.domains || [];
    } catch (error) {
      console.error('Error fetching domains by address:', error);
      return [];
    }
  }

  async resolveDomain(domain: string): Promise<DomainRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/resolve/${domain}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Domain not found
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error resolving domain:', error);
      return null;
    }
  }

  async checkDomainAvailability(domain: string): Promise<boolean> {
    try {
      const resolved = await this.resolveDomain(domain);
      return resolved === null; // Available if not found
    } catch (error) {
      console.error('Error checking domain availability:', error);
      return false;
    }
  }

  async getGlobalStats(): Promise<DomainStats | null> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching global stats:', error);
      return null;
    }
  }

  async getRecentDomains(limit = 10): Promise<DomainRecord[]> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/recent?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.domains || [];
    } catch (error) {
      console.error('Error fetching recent domains:', error);
      return [];
    }
  }
}

export const resolverApi = new ResolverApiService();