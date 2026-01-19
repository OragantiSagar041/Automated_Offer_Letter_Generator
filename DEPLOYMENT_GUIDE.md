# Deployment Guide 🚀

Your application is ready for deployment! Follow these steps to deploy the Backend to **Render** and Frontend to **Vercel**.

---

## Part 1: Deploy Backend (Render)

1.  **Push your code to GitHub** (if you haven't already).
2.  Go to [Render Dashboard](https://dashboard.render.com/) -> Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Configuration:**
    *   **Name:** `arah-backend` (or similar)
    *   **Root Directory:** `backend`
    *   **Environment:** `Python 3`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 10000`
5.  **Environment Variables (Scroll down to "Advanced"):**
    Add the following keys:
    *   `PYTHON_VERSION`: `3.9.0` (Recommended)
    *   `MAIL_USERNAME`: (Your Gmail)
    *   `MAIL_PASSWORD`: (Your App Password)
    *   `BREVO_API_KEY`: (Your Brevo Key)
    *   `BREVO_SENDER_EMAIL`: (Your Verified Sender Email)
    *   **Database Setup:**
        *   Render offers a "PostgreSQL" service separate from Web Service.
        *   Create a **New PostgreSQL** database on Render first.
        *   Copy the `Internal Database URL`.
        *   Go back to your Web Service -> Env Vars -> Add `DATABASE_URL` with that value.

6.  Click **Create Web Service**. Wait for it to go live (green).
7.  **Copy the Backend URL** (e.g., `https://arah-backend.onrender.com`). You need this for the Frontend.

---

## Part 2: Deploy Frontend (Vercel)

1.  Go to [Vercel Dashboard](https://vercel.com/) -> **Add New Project**.
2.  Import the same GitHub repository.
3.  **Configuration:**
    *   **Framework Preset:** Vite (should auto-detect).
    *   **Root Directory:** `./` (Default).
4.  **Environment Variables:**
    *   Name: `VITE_API_BASE_URL`
    *   Value: `https://arah-backend.onrender.com` (The URL you copied from Render).
    *   *Note: Do NOT add a trailing slash `/` at the end.*
5.  Click **Deploy**.

---

## 🎉 Done!
Your app will be live at the Vercel URL.
-   The Frontend will talk to the Render Backend.
-   The Backend will use the PostgreSQL Database.
