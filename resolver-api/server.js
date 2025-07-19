const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./ons.db');

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'active',
      last_verified DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Octra RPC configuration
const OCTRA_RPC_URL = 'https://octra.network';
const MASTER_WALLET = 'oct8UYokvM1DR2QpTD4mncgvRzfM6f9yDuRR1gmBASgTk8d';

// Helper function to verify transaction
async function verifyTransaction(txHash, domain, fromAddress) {
  try {
    const response = await axios.get(`${OCTRA_RPC_URL}/tx/${txHash}`);
    const tx = response.data;

    if (!tx || tx.status !== 'confirmed') {
      return false;
    }

    const parsedTx = tx.parsed_tx;
    const isValid = 
      parsedTx.to === MASTER_WALLET &&
      parsedTx.from === fromAddress &&
      parseFloat(parsedTx.amount) >= 0.5 &&
      parsedTx.message === `register_domain:${domain}.oct`;

    return isValid;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

// Routes

// Register a new domain
app.post('/api/domains', async (req, res) => {
  const { domain, address, tx_hash, status = 'active' } = req.body;

  if (!domain || !address || !tx_hash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // For pending status, skip verification
    let isValid = true;
    if (status === 'active') {
      // Verify transaction on-chain for active domains
      isValid = await verifyTransaction(tx_hash, domain, address);
    }
    
    if (!isValid && status === 'active') {
      return res.status(400).json({ error: 'Invalid transaction or insufficient payment' });
    }

    // Insert into database
    db.run(
      'INSERT INTO domains (domain, address, tx_hash, verified, status) VALUES (?, ?, ?, ?, ?)',
      [domain, address, tx_hash, status === 'active', status],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Domain already registered' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        res.status(201).json({
          id: this.lastID,
          domain,
          address,
          tx_hash,
          verified: status === 'active',
          status,
          created_at: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update domain status
app.put('/api/domains/:domain/status', (req, res) => {
  const { domain } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  db.run(
    'UPDATE domains SET status = ?, verified = ?, last_verified = CURRENT_TIMESTAMP WHERE domain = ?',
    [status, status === 'active', domain],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      res.json({ success: true, updated: this.changes });
    }
  );
});

// Get domains by address
app.get('/api/domains/address/:address', (req, res) => {
  const { address } = req.params;

  db.all(
    'SELECT * FROM domains WHERE address = ? ORDER BY created_at DESC',
    [address],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ domains: rows });
    }
  );
});

// Resolve domain to address
app.get('/api/domains/resolve/:domain', (req, res) => {
  const { domain } = req.params;

  db.get(
    'SELECT * FROM domains WHERE domain = ? AND verified = TRUE',
    [domain],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      res.json(row);
    }
  );
});

// Get recent domains
app.get('/api/domains/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  db.all(
    'SELECT * FROM domains WHERE verified = TRUE ORDER BY created_at DESC LIMIT ?',
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ domains: rows });
    }
  );
});

// Get global statistics
app.get('/api/stats', (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total_domains FROM domains WHERE verified = TRUE',
    'SELECT COUNT(DISTINCT address) as total_users FROM domains WHERE verified = TRUE',
    'SELECT COUNT(*) as recent_registrations FROM domains WHERE verified = TRUE AND created_at > datetime("now", "-1 day")'
  ];

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.get(query, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    })
  )).then(results => {
    res.json({
      total_domains: results[0].total_domains,
      total_users: results[1].total_users,
      recent_registrations: results[2].recent_registrations
    });
  }).catch(error => {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Database error' });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`ONS Resolver API running on port ${PORT}`);
  console.log(`Master wallet: ${MASTER_WALLET}`);
  console.log(`Octra RPC: ${OCTRA_RPC_URL}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});