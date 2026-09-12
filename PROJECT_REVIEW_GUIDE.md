# 🎯 Digital Udhaar Khata — Project Review & Viva Prep Guide

This guide is prepared to help you ace your project review this evening. It explains the design, architecture, and features of your project in simple, professional, and clear terms.

---

## 📁 Table of Contents
1. [Frontend & Backend in Simple Terms](#1-frontend--backend-in-simple-terms)
2. [How Login & Logout Works with Tokens](#2-how-login--logout-works-with-tokens)
3. [How Registration Works (Frontend & Backend Sync)](#3-how-registration-works-frontend--backend-sync)
4. [How CORS (Cross-Origin Resource Sharing) Works](#4-how-cors-cross-origin-resource-sharing-works)
5. [How Tokens are Stored & Protected](#5-how-tokens-are-stored--protected)
6. [How Tokens Validate Existing vs New Users (Session Verification)](#6-how-tokens-validate-existing-vs-new-users-session-verification)
7. [Comprehensive Feature Walkthrough](#7-comprehensive-feature-walkthrough)
8. [💡 Top 10 Mentor Questions & Smart Answers (Viva Prep)](#-top-10-mentor-questions--smart-answers-viva-prep)

---

## 1. Frontend & Backend in Simple Terms

To explain it to your mentors simply:

* **Frontend (The Client Side — React + Tailwind CSS)**: 
  * It is the **visual user interface (UI)** that the shopkeeper sees and interacts with (dashboards, input forms, voice recording buttons, chatbot assistant, charts).
  * It runs directly in the user's web browser.
  * It handles browser-level events (clicks, typing, voice capturing), displays data dynamically (without page reload via React State), and sends HTTP requests to the backend server to fetch or save ledger data.
* **Backend (The Server Side — Node.js + Express.js + MongoDB)**:
  * It is the **brain and database** of the application, running invisibly on a server.
  * It receives requests from the frontend, verifies who is requesting the data (authentication/authorization), communicates with **MongoDB** (using the Mongoose ORM) to fetch or update tables, and returns the requested data as clean JSON responses.
  * It handles heavy operations like hashing passwords, generating secure tokens, parsing voice inputs using AI APIs, scheduling automatic WhatsApp reminders, and generating PDF ledger receipts.

---

## 2. How Login & Logout Works with Tokens

Your project uses **JWT (JSON Web Token)** for managing user sessions. Here is the step-by-step flow:

### A. Login Flow
```mermaid
sequenceDiagram
    participant User as Browser (Frontend)
    participant Server as Node.js (Backend)
    participant DB as MongoDB

    User->>Server: POST /api/auth/login {email, password}
    Server->>DB: Find user by email
    DB-->>Server: Return User details & hashed password
    Server->>Server: Compare passwords (bcrypt.compare)
    Note over Server: If passwords match, sign JWT token<br/>Payload: {id: user._id, tokenVersion}
    Server-->>User: Return User Info + JWT Token
    Note over User: Save Token to localStorage ('udhaar-user')<br/>Update AuthContext state
```

1. **Credentials Submission**: The shopkeeper types their email and password on the frontend and clicks "Login". The frontend triggers an API post request: `POST /api/auth/login`.
2. **Database Verification**: The backend queries the MongoDB database for the user: `User.findOne({ email }).select('+password')`.
3. **Password Verification**: The backend compares the raw input password with the hashed password stored in the database using the `bcryptjs` library (`await user.comparePassword(password)`).
4. **Token Generation**: If correct, the backend signs a JWT token containing:
   * **Header**: Encoding algorithm.
   * **Payload**: User ID (`user._id`) and Session version (`user.tokenVersion`).
   * **Signature**: Hashed using a secret key stored on the server (`process.env.JWT_SECRET`).
   * **Expiration**: Valid for 30 days.
5. **Frontend Response**: The server sends a success response along with the token. The frontend saves this token in the browser's `localStorage` and redirects the user to the Dashboard.

### B. Logout Flow
1. **Trigger**: The user clicks the "Logout" button, OR the **Inactivity Tracker** detects 15 minutes of idle time and triggers a logout automatically.
2. **Action**: The frontend triggers the `logout()` function inside `AuthContext.jsx`.
3. **Storage Cleared**: The browser runs:
   ```javascript
   localStorage.removeItem('udhaar-user');
   sessionStorage.removeItem('udhaar-unlocked');
   ```
4. **State Reset**: The global React state `user` is set to `null`.
5. **Redirection**: Axios interceptors detect the absence of the token and redirect the user back to the `/login` route.

---

## 3. How Registration Works (Frontend & Backend Sync)

The registration flow handles creating a brand new account and securely storing credentials.

### A. Frontend Flow
1. The shopkeeper enters their details: Name, Email, Password, Store Name, Phone Number, and optionally selects an Avatar.
2. The React registration form performs validation (e.g., matching passwords, password length > 6).
3. It makes an API call to the backend: `POST /api/auth/register`.
4. On success, the response contains the newly created user object and a JWT token, allowing the user to bypass the login page and access the application immediately.

### B. Backend Flow & Pre-Save Password Hashing
1. **Uniqueness check**: The backend checks if the email is already registered in MongoDB:
   ```javascript
   const existingUser = await User.findOne({ email });
   if (existingUser) return res.status(400).json({ message: 'An account with this email already exists' });
   ```
2. **Database Insertion**: If the email is unique, it triggers: `User.create({ name, email, password, storeName, phone, avatar })`.
3. **Pre-Save Database Hook**:
   Inside `models/User.js`, there is a Mongoose middleware hook that automatically hashes the password using **bcrypt** before writing it to MongoDB:
   ```javascript
   userSchema.pre('save', async function (next) {
     if (this.isModified('password')) {
       const salt = await bcrypt.genSalt(12);
       this.password = await bcrypt.hash(this.password, salt);
     }
     next();
   });
   ```
   *This ensures that even if database administrators look at MongoDB, they will only see a salted hash and never the plaintext password.*
4. **Token Generation**: The backend generates a JWT token for the user ID and returns it with a status code of `201 Created`.

---

## 4. How CORS (Cross-Origin Resource Sharing) Works

### What is CORS?
CORS is a web browser security mechanism. It blocks a web application running at one origin (e.g., Port `5173`) from requesting resources from a different origin (e.g., Port `4000`).

### The Origin Gap in Development
* Frontend URL: `http://localhost:5173`
* Backend URL: `http://localhost:4000` (or `http://127.0.0.1:4000`)
* Since the ports are different, browsers classify them as different origins. By default, any raw browser API request from port 5173 to port 4000 would be blocked!

### How we solved it in this project:
We solved CORS in two different ways depending on development or production:

1. **Development Proxy (Vite Configuration)**:
   In `frontend/vite.config.js`, we set up a dev-server reverse proxy for `/api`:
   ```javascript
   proxy: {
     '/api': {
       target: 'http://127.0.0.1:4000',
       changeOrigin: true,
     },
   }
   ```
   * **How it works**: The React frontend sends requests to `/api/...` on its own origin (e.g., `http://localhost:5173/api/auth/login`).
   * Because the request is sent to the same origin, the browser permits it.
   * Vite's development server catches this request and redirects it under the hood (server-to-server) to the backend at `http://127.0.0.1:4000/api/auth/login`. Since server-to-server communications do not enforce CORS, this works smoothly!

2. **Backend CORS Support**:
   In `Backend/server.js`, we import and initialize the `cors` middleware:
   ```javascript
   const cors = require('cors');
   app.use(cors());
   ```
   * The backend sends `Access-Control-Allow-Origin: *` headers on its responses. This tells the browser that requests from any external origin (like Vercel, Netlify, or local ports) are authorized to access the API.

---

## 5. How Tokens are Stored & Protected

### Where is the token stored?
1. **Frontend Storage**: The token is stored in the browser's **Local Storage** (`localStorage`) inside the key `'udhaar-user'`.
   * **Why Local Storage?** It persists across browser tab closes and page reloads. When the shopkeeper reopens the page, they don't have to re-enter their credentials.
2. **React Global State**: During application runtime, the user's data and token are loaded into the React state inside `AuthContext.jsx` (`user` state) for fast access by other pages.

### How is the token attached to API requests?
To protect API endpoints, every request must carry the token. We use **Axios Request Interceptors** in `frontend/src/api/axios.js`:
```javascript
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('udhaar-user'));
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});
```
This interceptor runs automatically before every outgoing Axios request. It fetches the token from Local Storage and appends it to the HTTP headers as:
`Authorization: Bearer eyJhbGciOiJIUzI1Ni...`

---

## 6. How Tokens Validate Existing vs New Users (Session Verification)

When an API request arrives at the backend, the backend must verify that the token is valid, has not been tampered with, and belongs to an active user.

### The Authentication Middleware (`Backend/middleware/authMiddleware.js`)
Protected routes in the backend are wrapped in the `protect` middleware function:

```javascript
const protect = async (req, res, next) => {
  let token;
  // 1. Check if Authorization header starts with 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized — no token provided' });

  try {
    // 2. Decode the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Find the user in MongoDB
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'Not authorized — user not found' });

    // 4. Session Validation (Token Version check)
    const tokenVersion = decoded.tokenVersion || 0;
    if (tokenVersion !== req.user.tokenVersion) {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    next(); // Authenticated! Proceed to controller.
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized — invalid token' });
  }
};
```

### Checking Existing vs New Users:
* **For a New User**: When they register, the database creates their record with `tokenVersion: 0`. The backend issues a JWT containing `tokenVersion: 0`.
* **For an Existing User**: When they log in, the database reads their current `tokenVersion` and writes it to the JWT.
* **Security Token Revocation (Emergency Lock)**:
  Your project implements a custom security feature: **Emergency Lock**. 
  When the user triggers this lock, the backend increments their `tokenVersion` in MongoDB:
  `user.tokenVersion = (user.tokenVersion || 0) + 1`
  Immediately, all existing JWTs (carried by other browsers/devices) hold the old `tokenVersion`. The middleware rejects those requests because the versions do not match, instantly logging out all other devices!

---

## 7. Comprehensive Feature Walkthrough

Here are the key features implemented in your Digital Udhaar Khata app, ready for your presentation:

| Feature Name | How it works | Technology Stack |
| :--- | :--- | :--- |
| **Secure Authentication** | Hashed credentials with Bcrypt. Standard Email/Password login + Google Sign-In & Mock Google Sign-In. | JWT, BcryptJS, Google Auth API |
| **Security Lock Screen** | Prompting for a security PIN or WebAuthn Biometrics before letting a user view sensitive pages or UPI settings. | Local React State, Session Storage |
| **Session Activity Log** | Stores device name, browser, IP address, and location for the last 20 logins, warning users of unauthorized access. | User Agent Parser, MongoDB array |
| **Emergency Lock** | Instantly resets the shop password, increments `tokenVersion` to invalidate all active sessions, and alerts the owner via email. | Node Crypto, JWT Versioning, Nodemailer |
| **Interactive Ledger** | Tracks credit (Udhaar - Gave goods) and debit (Jama - Paid back) per customer. Generates real-time customer balances. | React, Express, Mongoose |
| **Cashbook Ledger** | Tracks generic cash register transactions (sales, rent, salaries, electricity bills) separate from customer udhaar. | Cashbook Schema, MongoDB aggregation |
| **AI voice transaction entry** | The shopkeeper records audio or says: *"Ravi took 500 rupees"* or *"Added rent 1000"*. The app parses it into a transaction automatically. | Voice Recognition, Groq API (Llama 3.1) / Indian Phonetic Key Fallback |
| **KathaGPT (AI Chatbot)** | Chatbot that answers questions about dues, collections, and risky customers in English, Hindi, and Telugu. | Mongoose Queries, Groq API |
| **Risk Level & Credit Scoring** | Analyzes payment frequency to tag customers as "Trusted", "Late Payer", or "Risky", assigning credit scores out of 900. | Custom Risk Scoring Algorithm |
| **Automated Reminders** | An auto-scheduler cron job runs daily to trigger automated payment reminders via WhatsApp, SMS, or Email. | Node Schedulers, WhatsApp Cloud API, Nodemailer |
| **PDF Ledger Statement** | Compiles transactions into a detailed PDF statement with shop branding for offline use. | PDFKit, Express stream |

---

## 💡 Top 10 Mentor Questions & Smart Answers (Viva Prep)

Keep these answers in mind when mentors ask you specific questions during your review:

### Q1: Why did you use JWT instead of Sessions?
> *"We used JSON Web Tokens (JWT) because they are stateless. The backend server does not need to store session states in memory. Instead, the user's session data is signed and sent to the client. This makes our backend lighter, faster, and highly scalable."*

### Q2: If a JWT is stolen, how do you prevent an attacker from keeping access forever?
> *"First, we set an expiration of 30 days. Second, we implemented a **Token Versioning** system. When a user changes their password or activates our **Emergency Lock** feature, we increment the `tokenVersion` in MongoDB. The next time the stolen token is used, our auth middleware checks it against the database and rejects it because the versions mismatch, locking the attacker out."*

### Q3: How did you implement passwords security in the database?
> *"We never save plaintext passwords. We use a Mongoose pre-save hook that hashes passwords using the **BcryptJS** algorithm with 12 salt rounds. When a user logs in, we use bcrypt's compare function to check if the passwords match, without ever decrypting the password."*

### Q4: How does the AI Voice Transaction Entry work?
> *"When a user speaks a phrase, the voice is transcribed. We pass the text transcript to the **Groq API** running a **Llama 3.1** model, prompting it to extract the amount, customer name, transaction type, and description in JSON format. If the API key is missing or offline, we fall back to a custom **Indian Phonetic Key** mapping algorithm that detects keywords in Hindi, Telugu, and English."*

### Q5: What database are you using, and why?
> *"We are using **MongoDB** (with Mongoose). A NoSQL database is ideal for this application because the ledger transactions, cashbook items, and user login logs have varying details. Mongoose makes it extremely easy to model collections and perform aggregations for business charts."*

### Q6: How are you handling file/PDF generation?
> *"We use the **PDFKit** package in the backend. When the shopkeeper requests a PDF summary, the backend queries the database for transactions, generates a styled PDF page stream dynamically, and pipes it directly as a download response to the client browser."*

### Q7: Explain what happens when a customer pays back Udhaar.
> *"A debit transaction is created in the Transaction collection. The customer's balance field in the Customer collection is updated (reduced by the paid amount). Finally, we recalculate the customer's Credit Score and Risk Level using our algorithm to update their risk status."*

### Q8: What happens in CORS if we deploy the frontend to Vercel and backend to Heroku/Render?
> *"On deployment, the origins are completely different. The Vite dev-server proxy will no longer run because Vite is compiled to static files on Vercel. However, since the backend uses the Express CORS middleware `app.use(cors())`, the backend explicitly allows our Vercel domain to send headers and bypass CORS restrictions."*

### Q9: Why did you use `axios.interceptors`?
> *"Axios interceptors let us execute custom code globally before a request is sent, or when a response is received. By adding a request interceptor, we automatically inject the JWT token into the header of every single request. By adding a response interceptor, we capture `401 Unauthorized` responses (like when a token expires) and redirect the user back to the login page."*

### Q10: How does the app notify shopkeepers about unauthorized login devices?
> *"For every login, the backend parses the `User-Agent` header of the HTTP request to extract the device name and browser. This is saved to a `loginActivities` array in the MongoDB User document. The frontend displays this list in the profile section, showing the last 20 logins with timestamps, IPs, and device details."*

---

Good luck with your review today! You have built a feature-rich, secure, and modern project. You'll do great!
