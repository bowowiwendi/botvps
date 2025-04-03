#!/bin/bash

# Script untuk update bot dengan mempertahankan servers.json dan admins.json

# Direktori kerja
TARGET_DIR="botvps"
BACKUP_DIR="/tmp/botvpn_backup"
REPO_URL="https://github.com/bowowiwendi/botvps.git"  # Ganti dengan repo Anda
PM2_APP_NAME="bot"  # Ganti dengan nama app PM2 Anda

# Fungsi untuk menangani error
handle_error() {
    echo "🔴 Error: $1"
    exit 1
}

# Buat direktori backup dengan verifikasi
echo "🔵 Membuat direktori backup..."
if ! mkdir -p "$BACKUP_DIR"; then
    handle_error "Gagal membuat direktori backup $BACKUP_DIR"
fi

echo "🔵 Memulai proses update bot..."

# 1. Stop aplikasi PM2 terlebih dahulu
echo "🔵 Menghentikan aplikasi PM2..."
pm2 stop "$PM2_APP_NAME" || echo "⚠️ Warning: Gagal menghentikan PM2 atau aplikasi tidak running"

# 2. Backup file penting (dengan verifikasi file sumber exist)
echo "🔵 Membackup servers.json dan admins.json..."
if [ -f "$TARGET_DIR/servers.json" ]; then
    cp "$TARGET_DIR/servers.json" "$BACKUP_DIR/" || handle_error "Gagal backup servers.json"
else
    echo "⚠️ Warning: servers.json tidak ditemukan, melanjutkan tanpa backup"
fi

if [ -f "$TARGET_DIR/admins.json" ]; then
    cp "$TARGET_DIR/admins.json" "$BACKUP_DIR/" || handle_error "Gagal backup admins.json"
else
    echo "⚠️ Warning: admins.json tidak ditemukan, melanjutkan tanpa backup"
fi

# 3. Hapus direktori lama jika ada
echo "🔵 Menghapus direktori lama..."
[ -d "$TARGET_DIR" ] && rm -rf "$TARGET_DIR"

# 4. Clone repository baru
echo "🔵 Melakukan git clone..."
if ! git clone "$REPO_URL" "$TARGET_DIR"; then
    handle_error "Gagal melakukan git clone"
fi

if [ ! -d "$TARGET_DIR" ]; then
    handle_error "Direktori target tidak tercreate setelah clone"
fi

# 5. Restore file backup jika ada
echo "🔵 Mengembalikan file backup..."
[ -f "$BACKUP_DIR/servers.json" ] && cp "$BACKUP_DIR/servers.json" "$TARGET_DIR/"
[ -f "$BACKUP_DIR/admins.json" ] && cp "$BACKUP_DIR/admins.json" "$TARGET_DIR/"

# 6. Update .gitignore
echo "🔵 Memperbarui .gitignore..."
cd "$TARGET_DIR" || handle_error "Gagal masuk ke direktori $TARGET_DIR"

# Buat .gitignore jika belum ada
touch .gitignore

# Pastikan file config ada di .gitignore
for file in servers.json admins.json; do
    if ! grep -q "^$file$" .gitignore; then
        echo "$file" >> .gitignore || echo "⚠️ Gagal menambahkan $file ke .gitignore"
    fi
done

# 7. Install dependencies jika perlu
echo "🔵 Menginstall dependencies..."
npm install || echo "⚠️ Warning: Gagal menginstall dependencies"

# 8. Restart aplikasi PM2
echo "🔵 Me-restart aplikasi PM2..."
pm2 restart "$PM2_APP_NAME" || handle_error "Gagal me-restart aplikasi PM2"

# 9. Selesai
echo "🟢 Update berhasil!"
echo "Backup disimpan di: $BACKUP_DIR"
