# ALAGA PROGRAM - Pre-Demo Checklist ✅

**Complete this 30 minutes before your presentation**

---

## 🔧 TECHNICAL SETUP

### Environment & Server
- [ ] `.env.local` file exists in project root
- [ ] Run: `pnpm dev` → server running on http://localhost:3000
- [ ] Test access: http://localhost:3000 (see homepage)

### Environment Variables (check `.env.local`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = set
- [ ] `SMS_DEV_MODE=true` ← **IMPORTANT FOR DEMO**
- [ ] `QR_CARD_SECRET` = set
- [ ] (Optional) `CLOUDINARY_*` keys = set (for document uploads)

### Database
- [ ] Supabase database is accessible
- [ ] Test data/sample accounts exist
- [ ] At least one admin account ready for demo

---

## 👤 TEST ACCOUNTS (Create or verify these exist)

### Admin Account
```
Email: admin@example.com
Password: [your secure password]
```
- [ ] Can login at http://localhost:3000/admin-login
- [ ] Can access dashboard
- [ ] Can view Account Requests section

### Resident Accounts (pre-create for backup)
```
Account 1:
- Email: juan@example.com
- Name: Juan Dela Cruz
- Mobile: 09151234567
- Status: Approved

Account 2 (OPTIONAL):
- Email: maria@example.com
- Name: Maria Garcia
- Mobile: 09151234568
- Status: Pending (to show approval flow)
```
- [ ] Can login as resident
- [ ] Can view dashboard
- [ ] Can request assistance

---

## 🖥️ HARDWARE & BROWSER

### Display
- [ ] Monitor/projector is working
- [ ] Browser zoom is set to 100% (Ctrl + 0)
- [ ] Screen resolution is readable from back of room

### Browser Setup
- [ ] Chrome/Edge/Firefox is open
- [ ] Bookmark: http://localhost:3000
- [ ] Bookmark: http://localhost:3000/admin-login
- [ ] All browser extensions disabled (for stability)
- [ ] Cache cleared (or use Incognito mode)

### Internet
- [ ] WiFi/Network is stable
- [ ] SMS notifications work (if not in dev mode)
- [ ] Cloudinary accessible (if using document uploads)

---

## 📄 DEMO MATERIALS

- [ ] **This checklist** is printed or visible
- [ ] **QUICK_DEMO_SCRIPT.md** is printed or in separate window
- [ ] **DEMO_GUIDE.md** is on hand (backup reference)
- [ ] Screenshots backed up (in case of issues)
- [ ] Sample image/file for document upload test
- [ ] Laptop power adapter connected

---

## ✅ WALKTHROUGH TEST (5 minutes)

Complete a **full dry run** before attendees arrive:

### Step 1: Signup Test
- [ ] Navigate to http://localhost:3000
- [ ] Click "Sign Up"
- [ ] Form fills and OTP can be sent
- [ ] Check terminal for OTP display (should show `[SMS] OTP: 123456` or similar)

### Step 2: Admin Login Test  
- [ ] Logout
- [ ] Go to http://localhost:3000/admin-login
- [ ] Admin can login successfully
- [ ] Dashboard loads with KPI cards

### Step 3: Account Review Test
- [ ] Click "Account Requests"
- [ ] Can see list of pending accounts
- [ ] Can click on account to view details

### Step 4: Approval Test
- [ ] Can click "Approve" button
- [ ] Status updates
- [ ] No errors in console

### Step 5: Assistance Request Test
- [ ] Logout as admin
- [ ] Login as resident
- [ ] Can navigate to assistance requests
- [ ] Can see form for submitting request

---

## 🚨 BACKUP PLANS

### If Technical Issue Occurs:
- [ ] Have **screenshots** of each demo step
- [ ] Have **video recording** of successful demo run
- [ ] Can switch to showing **screenshots + commentary**

### Quick Recovery Steps:
1. Browser page won't load?
   - Press F5 to refresh
   - Check if `pnpm dev` still running in terminal
   
2. Can't login?
   - Clear browser cookies (Ctrl+Shift+Del)
   - Try Incognito mode
   - Verify credentials in `.env.local`

3. OTP not showing?
   - Check terminal for `[SMS]` prefix
   - Look through terminal history (scroll up)
   - Verify `SMS_DEV_MODE=true` is set

4. Page very slow?
   - Restart browser
   - Restart `pnpm dev`
   - Check system resources (Task Manager)

---

## 🎯 ONE HOUR BEFORE DEMO

- [ ] Browser refreshed
- [ ] All pages pre-loaded (keep open in tabs)
- [ ] Terminal with `pnpm dev` running (verify in background)
- [ ] Demo script printed and at hand
- [ ] Phone on silent mode
- [ ] Laptop in "Presentation Mode" (Windows key + P)
- [ ] Open browser to homepage ready
- [ ] Take a deep breath! 😊

---

## 📋 DURING DEMO

- [ ] Start with overview slide/statement
- [ ] Follow QUICK_DEMO_SCRIPT.md line by line
- [ ] Speak clearly and make eye contact with audience
- [ ] Pause for questions between sections
- [ ] If stuck, reference DEMO_GUIDE.md talking points
- [ ] Keep demo moving (10-15 minutes target)

---

## 🏁 AFTER DEMO

- [ ] Ask for questions
- [ ] Collect feedback
- [ ] Take notes on questions/suggestions
- [ ] Stop `pnpm dev` after demo ends
- [ ] Close browser/cleanup

---

## 📞 EMERGENCY CONTACTS

In case of technical issues during demo:

- Database down → Check Supabase status page
- Supabase URL wrong → Check `.env.local` file
- SMS not working → Verify `SMS_DEV_MODE=true`
- General errors → Check terminal for error messages

---

## ✨ FINAL REMINDERS

- ✅ **Practice makes perfect** - Run through demo at least 2-3 times before presenting
- ✅ **Know your talking points** - Review "DEMO_GUIDE.md" talking points section
- ✅ **Stay calm** - Technical hiccups are normal, have a backup plan
- ✅ **Engage audience** - Ask questions like "What do you think about this?" 
- ✅ **Keep time** - Stick to 10-15 minutes for demo flow
- ✅ **End strong** - Close with key benefits and call to action

---

**STATUS: Ready for Demo!** ✅

Checkbox everything above and you're good to go! 🚀

---

*Questions? Refer to DEMO_GUIDE.md or QUICK_DEMO_SCRIPT.md*
