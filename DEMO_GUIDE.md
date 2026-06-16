# ALAGA PROGRAM - Demo Guide for Final Presentation

**System:** Digital Identification & Assistance Management System for Barangay Sta. Rita
**Duration:** 10-15 minutes
**Audience:** Stakeholders, officials, project reviewers

---

## 🎯 DEMO OVERVIEW

This demo showcases the complete workflow for registering residents and managing assistance requests in the Alaga Program system.

**Key Features to Highlight:**
- ✅ Resident registration & verification
- ✅ Admin dashboard & account management
- ✅ Assistance request processing
- ✅ Digital beneficiary cards with QR codes
- ✅ SMS notifications & OTP verification
- ✅ Document uploads & tracking
- ✅ Reports & analytics

---

## 📋 PREPARATION CHECKLIST

Before starting the demo:

- [ ] Test account credentials are ready
- [ ] Database is seeded with sample data
- [ ] SMS dev mode is enabled (`SMS_DEV_MODE=true`)
- [ ] All environment variables are set correctly
- [ ] Application is running: `pnpm dev` (http://localhost:3000)
- [ ] Browser is zoomed to 100% for visibility
- [ ] Have backup screenshots/data if needed

---

## ▶️ DEMO SCRIPT (Step-by-Step)

### **SECTION 1: WELCOME & OVERVIEW (1 minute)**

**What to say:**
> "Welcome to the Alaga Program - a digital system designed to streamline assistance management for our Barangay residents. Today, I'll show you how residents can register, how administrators verify their information, and how we track assistance requests efficiently."

**Show:**
- Navigate to http://localhost:3000
- Show the homepage with login/signup buttons

---

### **SECTION 2: RESIDENT SIGNUP & REGISTRATION (3-4 minutes)**

**What to say:**
> "Let's start with a new resident signing up. They'll fill in their basic information and get verified through OTP."

#### Step 2.1: Signup Form
1. Click **"Sign Up"** button
2. Fill in the form:
   - **Full Name:** Juan Dela Cruz
   - **Mobile Number:** 09151234567 (use valid format)
   - **Category:** Select "PWD (Person with Disability)" / "Senior Citizen" / "Solo Parent"
   - **Barangay:** Sta. Rita
   - **Click Next**

**Narrate:** "The system collects basic resident information and validates the mobile number for OTP verification."

#### Step 2.2: Verification Steps (Account Details)
3. **Step 2 - Account Details:**
   - Email address
   - Additional information
   - **Click Next**

4. **Step 3 - Valid ID Upload:**
   - Click upload area
   - Upload a sample ID image
   - **Click Next**

**Narrate:** "We require a valid ID for identity verification. The system securely stores these documents using Cloudinary."

5. **Step 4 - SMS OTP Verification:**
   - Click **"Send OTP"**
   - *In dev mode, OTP prints in terminal - show it*
   - Enter OTP code
   - **Click Verify & Complete**

**Narrate:** "The OTP ensures the mobile number is valid and belongs to the resident. In production, this is a real SMS message."

#### Step 2.3: Success Message
- Show success confirmation
- Account created! Status: Pending Admin Verification

**Key Point:** "The account is now pending approval from the admin team."

---

### **SECTION 3: ADMIN DASHBOARD & ACCOUNT VERIFICATION (4-5 minutes)**

**What to say:**
> "Now let's switch to the admin side. Administrators review pending accounts and approve or reject them."

#### Step 3.1: Admin Login
1. Go to http://localhost:3000/admin-login
2. Login with admin credentials:
   - **Email:** admin@example.com
   - **Password:** [use your demo admin password]
   - **Click Login**

**Narrate:** "Only authorized staff can access the admin dashboard."

#### Step 3.2: Admin Dashboard Overview
- Show the dashboard home page
- Highlight **KPI Cards:**
  - Total Accounts
  - Total Beneficiaries
  - Total Assistance Requests
  - Pending Reviews
  
**Narrate:** "This dashboard gives administrators a quick overview of all system activities and metrics."

#### Step 3.3: Account Requests Review
1. Navigate to **"Account Requests"** section
2. Click on the pending account (Juan Dela Cruz)
3. **Review:**
   - Personal information
   - Uploaded Valid ID (click preview to see image)
   - Category & documents
   
4. **Approve the Account:**
   - Click **"Approve"** button
   - System sends SMS notification to resident
   - Account status changes to "Approved"

**Narrate:** "When approved, the resident automatically receives an SMS notification and can now log in and request assistance."

**Alternative Demo:** Show rejection:
   - Click **"Reject"** button
   - Add rejection reason (e.g., "ID is unclear")
   - SMS is sent with rejection details

---

### **SECTION 4: ASSISTANCE REQUEST SUBMISSION (2-3 minutes)**

**What to say:**
> "Now the resident is approved. Let's see how they request assistance."

#### Step 4.1: Login as Resident
1. Logout from admin
2. Navigate to http://localhost:3000/login
3. Login with the resident account we just created (Juan Dela Cruz)
   - **Email:** juan@example.com
   - **Password:** [user's password]

#### Step 4.2: Submit Assistance Request
1. Click **"Request Assistance"** or navigate to assistance requests
2. Fill form:
   - **Assistance Type:** Select "Medical Assistance" / "Food Package" / etc.
   - **Description:** "Need financial assistance for hospitalization"
   - **Amount Needed:** ₱5,000
   - **Documents:** Upload supporting documents (medical certificate, hospital bill)
   - **Click Submit**

**Narrate:** "The resident submits a detailed request with supporting documents. The admin team will review this and decide on approval."

#### Step 4.3: Request Confirmation
- Show confirmation: "Request submitted successfully"
- Status: "Under Review"
- Request number displayed (e.g., 2026-001)

**Key Point:** "Each request gets a unique tracking number for follow-up."

---

### **SECTION 5: ADMIN PROCESSES REQUEST (2 minutes)**

**What to say:**
> "Back on the admin side, let's see how staff processes these requests."

#### Step 5.1: Admin Review
1. Switch back to admin account
2. Navigate to **"Assistance Requests"**
3. Click on the submitted request
4. Review:
   - Resident details
   - Request details & documents
   - Supporting files

#### Step 5.2: Process Request
1. **Approve or Reject:**
   - If Approve: Resident gets SMS notification
   - If Reject: Add reason why (missing documents, ineligible, etc.)

**Narrate:** "Administrators can quickly review and respond to requests. All communications are tracked and documented."

---

### **SECTION 6: BENEFICIARY CARDS & QR CODES (2 minutes)**

**What to say:**
> "Once a resident is approved, they receive a digital beneficiary card with a QR code for identification."

#### Step 6.1: View Beneficiary Card
1. As admin, navigate to **"Beneficiaries"**
2. Click on approved resident
3. Show **Beneficiary Card:**
   - Name, ID number (e.g., BENEF-001)
   - Category (PWD, Senior Citizen, Solo Parent)
   - QR Code
   - Issue date & expiry date

**Narrate:** "This QR code can be scanned at partner establishments for discounts and services. The card is digitally stored and can be displayed on any device."

#### Step 6.2: QR Code Demo (Optional)
- Show scanning capability
- Demonstrate what information is encoded

---

### **SECTION 7: REPORTS & ANALYTICS (1-2 minutes)**

**What to say:**
> "The system also generates comprehensive reports for analysis and decision-making."

#### Step 7.1: View Reports
1. Navigate to **"Reports"** section
2. Show available reports:
   - **Resident Summary:** Total by category, status distribution
   - **Assistance Summary:** By type, approval rate, pending
   - **Activity Logs:** All system actions tracked
   - **Export Options:** PDF, Excel downloads

**Narrate:** "Reports can be exported for presentations, budget planning, and compliance documentation."

---

### **SECTION 8: KEY FEATURES SUMMARY (1 minute)**

**Say:** "Let me highlight the key features we've demonstrated:"

| Feature | Benefit |
|---------|---------|
| **SMS OTP Verification** | Ensures valid resident contact information |
| **Document Uploads** | Secure, centralized storage of ID & supporting docs |
| **Role-Based Access** | Admin, Staff, and Resident portals with specific permissions |
| **Real-time Notifications** | Residents updated immediately on status changes |
| **QR Digital Cards** | Modern ID verification for partner establishments |
| **Comprehensive Reports** | Data-driven decision making & compliance tracking |
| **Mobile-Responsive** | Works on smartphones for resident access |

---

## 🚀 DEMO VARIATIONS (If Time Allows)

### **If you have extra time, show:**

1. **Bulk Import:**
   - Show how admins can import resident data from Excel files
   - Save time for large-scale registration

2. **Activity Logs:**
   - Show who did what, when, and why
   - Important for accountability & audit trails

3. **Search & Filter:**
   - Demonstrate searching residents by name, category, status
   - Show filtering by date range

4. **Notifications Panel:**
   - Show how residents & admins receive real-time updates
   - Click notification to view details

---

## ⚠️ TROUBLESHOOTING DURING DEMO

| Issue | Solution |
|-------|----------|
| SMS OTP not showing | Check `SMS_DEV_MODE=true` in `.env.local`. Check terminal for OTP. |
| Document preview fails | Ensure Cloudinary credentials are set correctly. |
| Admin account locked | Clear cookies or use incognito mode. |
| Slow page load | Restart `pnpm dev`. Check database connection. |
| Mobile number validation fails | Use format: 09XX-XXX-XXXX or +63-9XX-XXX-XXXX |

---

## 💡 TALKING POINTS

### **Why This System?**
- "Eliminates manual paperwork and reduces processing time"
- "Provides transparency - residents can track their requests anytime"
- "Creates an audit trail for accountability"

### **For Residents:**
- "Easy registration process from any device"
- "Instant notifications on status changes"
- "Secure digital ID card for partner benefits"

### **For Administrators:**
- "Centralized management of all requests"
- "Quick overview of metrics and KPIs"
- "Exportable reports for decision-making"

### **For the Barangay:**
- "Efficient resource allocation"
- "Reduced administrative burden"
- "Better data for planning assistance programs"

---

## 📸 SUGGESTED SCREENSHOTS/SLIDES

Before the demo, prepare screenshots of:
1. Signup flow (all 4 steps)
2. Admin dashboard KPI cards
3. Beneficiary card with QR code
4. Sample reports
5. SMS notification example

---

## ✅ CLOSING STATEMENT

> "The Alaga Program transforms how we manage assistance in our barangay. By combining ease of use with robust admin controls, we ensure residents get help quickly while maintaining accountability. The system is scalable, secure, and designed with both residents and administrators in mind. Thank you!"

---

## 📞 Q&A PREP

**Likely Questions:**

**Q: Is resident data secure?**
A: "Yes. We use industry-standard encryption (Supabase), role-based access control, and all documents are handled with privacy compliance in mind."

**Q: What if a resident loses their phone?**
A: "The QR card is digital and can be re-sent via email or regenerated in the system. We also have a recovery process."

**Q: How much does this cost to run?**
A: "It's cost-effective. Hosting is on Vercel, database on Supabase - both have free tiers or affordable pay-as-you-go pricing."

**Q: Can we integrate with existing systems?**
A: "The API is flexible and can be customized for integration with other barangay systems."

---

## 📝 NOTES FOR PRESENTER

- **Practice beforehand:** Go through the demo at least twice
- **Have a backup plan:** Keep screenshots ready in case of technical issues
- **Manage time:** Stick to 10-15 minutes for main demo
- **Engage audience:** Ask questions like "What do you think about this feature?"
- **Stay calm:** Technical hiccups happen - have a backup demo account ready
- **End on high note:** Show the QR code feature or a nice report export

---

**Good luck with your presentation! 🎉**
