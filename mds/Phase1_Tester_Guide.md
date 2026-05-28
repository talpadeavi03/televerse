# TeleVerse — Phase 1: QA & Verification Testing Guide

This testing guide provides a step-by-step checklist for a Quality Assurance (QA) engineer or tester to verify all baseline functional features implemented in **TeleVerse Phase 1**.

---

## 📋 Pre-Testing Checklist

Before initiating manual tests, verify the current container status using the Hugging Face Space startup logs:
- [ ] **Redis Connection**: Local Redis cache server successfully bound to port `6379`.
- [ ] **Database Setup**: Postgres database successfully created, and all three extensions (`uuid-ossp`, `pgcrypto`, `vector`) applied.
- [ ] **Drizzle Migrations**: Terminal prints `[✓] migrations applied successfully!` (indicating all database schemas are correctly set up).
- [ ] **Fastify API Boot**: Terminal prints `Checking backend servers health... Ready!` and does **not** print any `❌ Fastify API failed to start!` warnings.
- [ ] **Nginx Reverse Proxy**: Terminal prints `Starting Nginx Reverse Proxy on port 7860...`.

---

## 🧪 Test Suite Scenarios

### Scenario 1: Public Landing Page & Responsiveness
*This scenario verifies that the public landing page loads correctly, is visually stunning, and works on all device displays.*

1. **Action**: Open your browser and navigate directly to your live URL: 👉 **[https://talpadeavi20-televerse.hf.space](https://talpadeavi20-televerse.hf.space)**
   *(If you are testing inside the Hugging Face Spaces frame, Firefox or Chrome might show an iframe security blocking page. Click the direct link to open the app in a new standalone tab).*
2. **Verification Points**:
   - [ ] Verify that the modern typography (**Inter font**) and purple-indigo radial gradients load seamlessly.
   - [ ] Verify that all **Lucide SVG Icons** (Cloud, Zap, Shield, Cpu, Github, ArrowRight) render cleanly.
   - [ ] Scroll to the comparative storage table. Verify that all values for Google Drive, OneDrive, and TeleVerse render with correct alignments.
   - [ ] Resize the browser window. Verify that the navbar, features grid, and footer scale elegantly for mobile, tablet, and desktop screens.

---

### Scenario 2: Platform Registration (PostgreSQL Integration)
*This scenario verifies that new users can register on the platform, and that passwords are encrypted and saved securely.*

1. **Action**: On the landing page, click **"Get Started"** or navigate directly to: 👉 **[https://talpadeavi20-televerse.hf.space/auth/register](https://talpadeavi20-televerse.hf.space/auth/register)**
2. **Test Steps**:
   - Enter a test email (e.g., `tester@televerse.app`).
   - Enter a secure password (must be at least **8 characters**; try a short password first to verify validation works).
   - Click **"Sign Up"**.
3. **Verification Points**:
   - [ ] Verify that entering a password shorter than 8 characters prevents form submission.
   - [ ] Verify that submitting valid credentials registers the account successfully and automatically redirects you to the dashboard page (`/drive/connect`).
   - [ ] *Database Audit*: (For administrators) Check your Supabase database table `users`. Verify that a new record has been inserted, and that the password is saved as a secure scrypt hash (e.g., `salt:hash`), **never** in plain text.

---

### Scenario 3: Platform Login & Token Rotation (JWT & Redis)
*This scenario verifies that users can authenticate with their credentials, receive tokens, and maintain secure session states.*

1. **Action**: Navigate to the Sign In page: 👉 **[https://talpadeavi20-televerse.hf.space/auth/login](https://talpadeavi20-televerse.hf.space/auth/login)**
2. **Test Steps**:
   - Enter the test credentials registered in Scenario 2.
   - Enter an incorrect password first to verify error handling.
   - Enter the correct credentials and click **"Sign In"**.
3. **Verification Points**:
   - [ ] Verify that entering incorrect credentials prints a clear `Invalid credentials` error message without crashing the page.
   - [ ] Verify that successful login redirects you to the `/drive/connect` dashboard page.
   - [ ] *Security Audit*: Open your browser Developer Tools (F12) ➜ Navigate to **Application** (or **Storage**) ➜ **Local Storage**. Verify that a secure JSON Web Token (JWT) `accessToken` and a unique `refreshToken` have been cached successfully.

---

### Scenario 4: Platform Onboarding Dashboard (Visual State)
*This scenario verifies that users are presented with the onboarding page to link their Telegram accounts.*

1. **Action**: Log in and access the default drive dashboard: 👉 **[https://talpadeavi20-televerse.hf.space/drive/connect](https://talpadeavi20-televerse.hf.space/drive/connect)**
2. **Verification Points**:
   - [ ] Verify that the page loads the Telegram Link Account form.
   - [ ] Verify that the phone number input field is formatted, and that clicking "Send Code" opens the subsequent verification fields (OTP code and 2FA password inputs).
   - [ ] Verify that the layout remains responsive on mobile displays.

---

### Scenario 5: System Health API & Swagger Documentation
*This scenario verifies that the backend gateway public endpoints and the REST documentation UI are active and accessible.*

1. **Action**: Navigate directly to the system health endpoint: 👉 **[https://talpadeavi20-televerse.hf.space/health](https://talpadeavi20-televerse.hf.space/health)**
2. **Verification Points**:
   - [ ] Verify that the page returns a valid JSON response matching this schema:
     ```json
     {
       "status": "ok",
       "ts": "2026-05-28T..."
     }
     ```
3. **Action**: Navigate directly to the interactive API documentation: 👉 **[https://talpadeavi20-televerse.hf.space/docs](https://talpadeavi20-televerse.hf.space/docs)**
4. **Verification Points**:
   - [ ] Verify that the beautiful **Swagger UI** loads completely.
   - [ ] Verify that all REST endpoint definitions under the `/v1/auth`, `/v1/telegram`, `/v1/files`, `/v1/folders`, and `/v1/share` namespaces are fully documented and visible.

---
*End of QA Testing Guide — Phase 1 verified healthy!*
