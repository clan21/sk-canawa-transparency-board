# Sangguniang Kabataan (SK) Canawa — Online Transparency Portal

An official online transparency portal built for the **Sangguniang Kabataan (SK) Council of Barangay Canawa**. This platform allows the public and local youth to easily view and download official council documents, promoting accessible and transparent governance.

🌐 **Live Website:** [https://sk-canawa-transparency-board.pages.dev/home](https://sk-canawa-transparency-board.pages.dev/home)

## 📱 Quick Access
Visit the link above or scan the QR code below to access the transparency portal on your mobile device:

![SK Canawa Transparency Portal QR Code](./qr-code.png)

## ✨ Key Features
* **Public Document Access:** View and download official SK records, including the Annual Barangay Youth Investment Program (ABYIP), financial reports, resolutions, and other public notices.
* **Engagement Tracking:** Built-in view and download counters to monitor public reach and document access.
* **Secure Admin Dashboard:** Protected administrative portal (`admin.html` / `dashboard.html`) with session authentication for authorized SK officials to upload and manage documents.

## 🔐 Admin Account Management
* **No Self-Registration:** For security purposes, there is no public sign-up or "Add Admin" feature inside the admin dashboard UI.
* **Database Provisioning:** New administrator accounts can only be created manually by the system maintainer directly inside the **Cloudflare D1 database** (see `README-accounts.txt` and `/migrations` for schema details).

## 🛠️ Tech Stack
* **Frontend:** HTML, CSS, Vanilla JavaScript, bundled with **Vite**
* **Backend & Hosting:** **Cloudflare Pages** & **Cloudflare Functions** (`/functions`)
* **Storage & Database:** **Cloudflare R2** (for PDF/document file storage) and **Cloudflare D1** (`/migrations`)

## 🚀 Local Development Setup
If you want to run or update this project locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd sk-canawa-transparency-board
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
