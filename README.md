# Octra DApp Example

Example DApp yang mendemonstrasikan cara mengintegrasikan dengan Octra Web Wallet menggunakan sistem redirect connection.

## Fitur

- **Wallet Connection**: Koneksi ke Octra Web Wallet menggunakan redirect flow
- **Wallet Management**: Menyimpan status koneksi dan informasi wallet
- **DApp Interface**: Interface sederhana untuk berinteraksi dengan wallet yang terhubung
- **Responsive Design**: UI yang responsif dengan dark mode support

## Cara Kerja

1. **Connection Request**: DApp mengarahkan user ke Octra Web Wallet dengan parameter:
   - `success_url`: URL callback untuk koneksi berhasil
   - `failure_url`: URL callback untuk koneksi ditolak
   - `origin`: Origin DApp
   - `app_name`: Nama aplikasi

2. **Wallet Authorization**: User melihat request koneksi di wallet dan memilih:
   - Wallet mana yang akan digunakan
   - Approve atau reject koneksi

3. **Callback**: Wallet mengarahkan kembali ke DApp dengan:
   - `account_id`: Address wallet yang dipilih
   - `public_key`: Public key wallet

4. **Session Management**: DApp menyimpan informasi koneksi di localStorage

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update URL wallet di `src/contexts/WalletContext.tsx`:
```typescript
const walletUrl = 'https://your-wallet-url.com'; // Ganti dengan URL wallet Anda
```

3. Jalankan development server:
```bash
npm run dev
```

## Konfigurasi Wallet

Pastikan wallet Anda sudah mengimplementasikan:

1. **Connection Handler**: Menangani parameter URL untuk connection request
2. **DApp Connection Component**: UI untuk approve/reject koneksi
3. **Redirect Logic**: Mengarahkan kembali ke DApp dengan hasil koneksi

## Struktur Project

```
src/
├── components/
│   ├── WalletConnection.tsx    # Komponen untuk koneksi wallet
│   └── DAppInterface.tsx       # Interface utama DApp
├── contexts/
│   └── WalletContext.tsx       # Context untuk state management wallet
├── App.tsx                     # Komponen utama
└── main.tsx                    # Entry point
```

## Pengembangan Lebih Lanjut

Anda dapat mengembangkan DApp ini dengan menambahkan:

- **Transaction Signing**: Request signing transaksi melalui wallet
- **Balance Checking**: Mengecek balance melalui API
- **Smart Contract Interaction**: Berinteraksi dengan smart contract
- **Multi-wallet Support**: Support untuk multiple wallet providers

## Catatan Keamanan

- Jangan pernah minta private key dari user
- Selalu validasi data yang diterima dari wallet
- Gunakan HTTPS untuk production
- Implementasikan proper error handling