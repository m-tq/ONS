# ONS Resolver API

Off-chain resolver API for ONS (Octra Name Service) that provides domain registration and resolution services.

## Features

- **Domain Registration**: Verify on-chain transactions and register domains
- **Domain Resolution**: Resolve domain names to Octra addresses
- **User Domains**: Get all domains registered by a specific address
- **Global Statistics**: Network-wide statistics and metrics
- **Transaction Verification**: Verify payments to master wallet

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### POST /api/domains
Register a new domain after verifying the transaction.

**Body:**
```json
{
  "domain": "example",
  "address": "oct1...",
  "tx_hash": "abc123..."
}
```

### GET /api/domains/address/:address
Get all domains registered by an address.

### GET /api/domains/resolve/:domain
Resolve a domain to its associated address.

### GET /api/domains/recent?limit=10
Get recently registered domains.

### GET /api/stats
Get global network statistics.

### GET /api/health
Health check endpoint.

## Database Schema

The API uses SQLite with the following schema:

```sql
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE
);
```

## Transaction Verification

The API verifies transactions by:

1. Fetching transaction details from Octra RPC
2. Checking transaction status is 'confirmed'
3. Verifying recipient is the master wallet
4. Confirming amount is at least 0.5 OCT
5. Validating message format: `register_domain:{domain}.oct`

## Security

- All transactions are verified on-chain before registration
- Domain uniqueness is enforced at database level
- Input validation and sanitization
- CORS enabled for frontend integration

## Monitoring

- Health check endpoint for monitoring
- Comprehensive error logging
- Graceful shutdown handling