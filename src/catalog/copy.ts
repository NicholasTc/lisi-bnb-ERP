import type { Language } from "./types";
export const copy: Record<Language, Record<string, string>> = {
  id: {
    test: "Uji lokal saja. Jangan melakukan pembayaran sungguhan.", staff: "Masuk staf", title: "Main lagi. Segar lagi.", intro: "Pilih minuman favoritmu. Kami antar ke lapangan.",
    location: "Lokasi lapangan", choose: "Pilih lapangan", change: "Ubah", confirm: "Konfirmasi lapangan", confirmed: "Lapangan dikonfirmasi",
    unconfirmed: "Periksa lapanganmu sebelum melanjutkan.", noLocation: "Belum memilih lapangan", noCourts: "Lokasi lapangan belum tersedia. Kamu tetap bisa melihat menu.",
    invalid: "Tautan QR tidak cocok dengan lapangan yang tersedia. Pilih lapangan yang benar.", menu: "Menu hari ini", refresh: "Muat ulang", search: "Cari menu",
    searchPlaceholder: "Cari minuman…", all: "Semua", unavailable: "Habis sementara", loading: "Sedang memuat menu…", empty: "Menu belum tersedia. Silakan tanyakan kepada staf kafe.",
    noMatches: "Tidak ada menu yang cocok. Coba kata lain atau pilih Semua.", offline: "Menu belum bisa diperbarui. Periksa koneksi dan coba lagi. Informasi yang terlihat mungkin sudah berubah.",
    preview: "Saat ini kamu bisa melihat menu. Pemesanan online belum tersedia.", prices: "Harga dalam rupiah, sudah termasuk pajak dan biaya layanan.",
    locationError: "Lapangan belum bisa dikonfirmasi. Muat ulang dan pilih kembali.", table: "Meja",
  },
  en: {
    test: "Local testing only. Do not make real payments.", staff: "Staff sign in", title: "Good drinks. Better breaks.", intro: "Pick your courtside refreshment. We’ll bring it to you.",
    location: "Court location", choose: "Choose a court", change: "Change", confirm: "Confirm court", confirmed: "Court confirmed",
    unconfirmed: "Check your court before continuing.", noLocation: "No court selected", noCourts: "Court locations are not available yet. You can still browse the menu.",
    invalid: "This QR link does not match an available court. Choose the correct court.", menu: "Today's menu", refresh: "Refresh", search: "Search menu",
    searchPlaceholder: "Find your next refreshment…", all: "All", unavailable: "Temporarily unavailable", loading: "Loading the menu…", empty: "The menu is not available yet. Please ask the café team.",
    noMatches: "No matching items. Try another search or select All.", offline: "The menu could not be refreshed. Check your connection and try again. Displayed information may have changed.",
    preview: "You can browse the menu here. Online ordering is not available yet.", prices: "Prices are in rupiah and include tax and service charges.",
    locationError: "The court could not be confirmed. Refresh and choose again.", table: "Table",
  },
};
