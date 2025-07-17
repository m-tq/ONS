# ONS - Octra Name Service

ONS (Octra Name Service) adalah sistem penamaan domain untuk alamat Octra yang memungkinkan pengguna mengubah alamat Octra yang panjang (oct1gsfUhgj...Iu98) menjadi nama domain yang mudah dibaca (foo.oct).

## Fitur

- **Domain Registration**: Daftarkan alamat Octra Anda sebagai domain .oct
- **Domain Resolution**: Cari dan resolve domain ke alamat Octra
- **User Dashboard**: Kelola semua domain yang Anda miliki
- **Global Statistics**: Statistik jaringan ONS secara real-time
- **Wallet Integration**: Integrasi dengan Octra Web Wallet
- **Transaction Verification**: Verifikasi pembayaran on-chain yang trustless

## Arsitektur

```
[User Wallet] <---> [Octra RPC Node] <---> [ONS Smart Contract (Master Wallet)]
                                   |
                            [Event Listener]
                                   |
                           [Off-chain Resolver API]
                                   |
                               [Frontend dApp]
```

## Cara Kerja

1. **Domain Registration**:
   - User mengirim 0.5 OCT ke master wallet
   - Message: `register_domain:{domain}.oct`
   - Sistem memverifikasi transaksi on-chain
   - Domain disimpan di off-chain resolver

2. **Domain Resolution**:
   - Query domain melalui resolver API
   - Return alamat Octra yang terkait
   - 100% trustless verification

3. **Verification Process**:
   - Cek status transaksi = 'confirmed'
   - Verify recipient = master wallet
   - Confirm amount >= 0.5 OCT
   - Validate message format

## Setup

### Frontend DApp

1. Install dependencies frontend:
```bash
npm install
```

2. Update URL wallet di `src/contexts/WalletContext.tsx` jika diperlukan:
```typescript
const walletUrl = 'http://localhost:5173'; // URL wallet Anda
```

3. Jalankan frontend:
```bash
npm run dev
```

### Resolver API

1. Masuk ke direktori resolver API:
```bash
cd resolver-api
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment:
```bash
cp .env.example .env
```

4. Jalankan API server:
```bash
npm run dev
```

## Konfigurasi

### Master Wallet
- Address: `oct8UYokvM1DR2QpTD4mncgvRzfM6f9yDuRR1gmBASgTk8d`
- Biaya registrasi: 0.5 OCT
- Format message: `register_domain:{domain}.oct`

### RPC Endpoint
- Octra Network: `https://octra.network`
- Transaction query: `https://octra.network/tx/{tx_hash}`

### Faucet
- URL: `https://oct-faucet.xme.my.id`
- Untuk mendapatkan OCT gratis jika balance tidak cukup

## Struktur Project

```
src/
├── components/
│   ├── WalletConnection.tsx    # Komponen koneksi wallet
│   ├── ONSInterface.tsx        # Interface utama ONS
│   ├── DomainRegistration.tsx  # Form registrasi domain
│   ├── DomainLookup.tsx        # Pencarian domain
│   ├── UserDomains.tsx         # Dashboard domain user
│   ├── GlobalStats.tsx         # Statistik global
│   └── ui/                     # Komponen UI (Radix/shadcn)
├── contexts/
│   ├── WalletContext.tsx       # Context wallet
│   └── ONSContext.tsx          # Context ONS
├── services/
│   ├── octraRpc.ts            # Service RPC Octra
│   └── resolverApi.ts         # Service resolver API
├── lib/
│   └── utils.ts               # Utility functions
├── App.tsx                     # Komponen utama
└── main.tsx                    # Entry point

resolver-api/
├── server.js                   # Express server
├── package.json               # Dependencies
└── README.md                  # API documentation
```

## API Endpoints

### POST /api/domains
Registrasi domain baru setelah verifikasi transaksi.

### GET /api/domains/address/:address
Dapatkan semua domain yang dimiliki alamat tertentu.

### GET /api/domains/resolve/:domain
Resolve domain ke alamat Octra.

### GET /api/stats
Statistik global jaringan ONS.

## Fitur Keamanan

- **On-chain Verification**: Semua transaksi diverifikasi langsung ke blockchain
- **Trustless System**: Tidak perlu mempercayai pihak ketiga
- **Master Wallet Verification**: Pembayaran hanya valid ke master wallet
- **Amount Verification**: Minimum 0.5 OCT untuk registrasi
- **Message Validation**: Format message harus sesuai

## Pengembangan Selanjutnya

Fitur yang dapat ditambahkan:

- **Domain Transfer**: Transfer kepemilikan domain
- **Subdomain Support**: Support untuk subdomain (sub.domain.oct)
- **Domain Expiry**: Sistem expired dan renewal domain
- **Reverse Resolution**: Resolve alamat ke domain utama
- **IPFS Integration**: Link domain ke konten IPFS
- **ENS Compatibility**: Kompatibilitas dengan Ethereum Name Service

## Troubleshooting

### Domain Registration Gagal
1. Pastikan balance OCT >= 0.5
2. Cek format message: `register_domain:{domain}.oct`
3. Pastikan mengirim ke master wallet yang benar
4. Tunggu konfirmasi transaksi

### Resolver API Error
1. Pastikan API server berjalan di port 3001
2. Cek koneksi ke Octra RPC
3. Verify database permissions

### Wallet Connection Issues
1. Update URL wallet di WalletContext
2. Pastikan wallet mendukung redirect flow
3. Cek CORS settings