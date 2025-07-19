export interface DomainRecord {
  id: number;
  domain: string;
  address: string;
  tx_hash: string;
  created_at: string;
  verified: boolean;
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

  async registerDomain(domain: string, address: string, txHash: string): Promise<DomainRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          address,
          tx_hash: txHash,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error registering domain:', error);
      return null;
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