# Cardinal Hotel PMS - WhatsApp Mikroservisi

Bu mikroservis **Cardinal Hotel PMS** üçün WhatsApp vasitəsilə bildirişlərin göndərilməsi, QR kod ilə qoşulma və qonaqlara rezervasiya məlumatlarının çatdırılmasını təmin edir.

## 🚀 Başlatma Təlimatı

### 1. Asılılıqları quraşdırın:
```bash
cd whatsapp-microservice
npm install
```

### 2. Mikroservisi işə salın:
```bash
npm start
```
*Server standart olaraq `http://localhost:3001` portunda işə düşəcək.*

---

## 📡 API Endpoints

- **`GET /status`** - WhatsApp mikroservisinin və bağlantının statusunu qaytarır.
- **`GET /qr`** - Qoşulma üçün QR kod məlumatını qaytarır.
- **`POST /send-message`** - Telefon nömrəsinə mesaj göndərir.
  ```json
  {
    "phone": "+994501234567",
    "message": "Hörmətli qonaq, rezervasiyanız təsdiqləndi!"
  }
  ```
- **`POST /disconnect`** - WhatsApp sessiyasını ayırır.
- **`GET /history`** - Göndərilmiş son 50 mesajın tarixçəsi.

---

## 🐳 Docker ilə Başlatma:
```bash
docker build -t cardinal-whatsapp .
docker run -p 3001:3001 cardinal-whatsapp
```
