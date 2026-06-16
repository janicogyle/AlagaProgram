# ALAGA PROGRAM - Quick Demo Script
**Use this as a quick reference during presentation**

---

## ⚡ QUICK SETUP

```bash
# Before starting demo
pnpm dev

# Make sure these are set in .env.local:
SMS_DEV_MODE=true          # Shows OTP in terminal
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 🚀 DEMO FLOW (10-15 min)

### 1️⃣ RESIDENT SIGNUP (3 min)
- **URL:** http://localhost:3000
- **Click:** Sign Up
- **Form:**
  - Full Name: `Juan Dela Cruz`
  - Mobile: `09151234567`
  - Category: `PWD`
  - **Next** → **Next** → Upload ID → **Send OTP**
  - Check terminal for OTP (SMS_DEV_MODE)
  - Enter OTP → **Complete**
- **Result:** "Account created - Pending Admin Approval"

---

### 2️⃣ ADMIN LOGIN (1 min)
- **URL:** http://localhost:3000/admin-login
- **Credentials:**
  - Email: `admin@example.com`
  - Password: `[your admin password]`
- **Show:** Dashboard KPIs

---

### 3️⃣ APPROVE ACCOUNT (2 min)
- Click **"Account Requests"** (left sidebar)
- Click pending account: `Juan Dela Cruz`
- **Show:**
  - Personal info
  - Click uploaded ID to preview
  - Status: Pending
- **Click:** "Approve" button
- **Result:** SMS sent to resident

---

### 4️⃣ RESIDENT REQUESTS ASSISTANCE (2 min)
- **Logout** as admin (top right)
- **URL:** http://localhost:3000/login
- **Login as resident:**
  - Email: `juan@example.com`
  - Password: `[user password from signup]`
- **Click:** Request Assistance / Assistance Requests
- **Form:**
  - Assistance Type: `Medical Assistance`
  - Description: `Need hospitalization support`
  - Amount: `₱5,000`
  - Upload document (optional)
  - **Submit**
- **Result:** "Request number: 2026-001"

---

### 5️⃣ ADMIN REVIEWS REQUEST (1 min)
- Login as admin again
- Click **"Assistance Requests"**
- Click the request from Juan
- **Show:**
  - Request details
  - Documents
  - Status buttons: Approve / Reject
- **Click:** Approve (or Reject to show rejection flow)

---

### 6️⃣ BENEFICIARY CARD & QR (1 min)
- Admin → **"Beneficiaries"**
- Click on Juan's name
- **Show:**
  - Name: Juan Dela Cruz
  - ID: BENEF-001
  - QR Code
  - Category badge

---

### 7️⃣ REPORTS (1 min)
- Admin → **"Reports"** (bottom sidebar)
- Show:
  - **Residents Summary:** Charts & counts
  - **Assistance Summary:** By type
  - **Export** button: Download as PDF/Excel

---

## 💬 TALKING POINTS

| Section | Say |
|---------|-----|
| **Signup** | "Simple, 4-step registration process accessible to all residents on any device." |
| **OTP** | "SMS verification ensures real phone numbers and security." |
| **Admin Review** | "Admins quickly review and approve accounts with document verification." |
| **Assistance** | "Residents submit requests with tracking numbers for transparency." |
| **Card** | "Digital QR card works with partner establishments for discounts." |
| **Reports** | "Data-driven insights for better decision-making and budgeting." |

---

## 🔑 KEY STATS TO MENTION

- ✅ **Faster Processing:** From weeks to minutes
- ✅ **Transparent:** Residents can track their requests 24/7
- ✅ **Secure:** Industry-standard encryption & access control
- ✅ **Mobile-First:** Works on any smartphone
- ✅ **Scalable:** Can handle thousands of residents

---

## ⚠️ QUICK FIXES

| Problem | Fix |
|---------|-----|
| OTP not in terminal | Terminal might be scrolled up. Search for `[SMS]` in terminal |
| Login fails | Try incognito mode or clear cookies |
| Page won't load | Refresh browser. Check if `pnpm dev` is still running |
| Upload fails | Check Cloudinary credentials in `.env.local` |
| SMS not showing | Make sure `SMS_DEV_MODE=true` |

---

## 🎯 DEMO ENDING

> "The Alaga Program makes assistance management easy for residents and efficient for administrators. Questions?"

---

**Print this and keep it handy during the presentation!**
