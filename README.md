# Live Crypto Dashboard (Webflow Integrated)

A professional, data-driven analytics dashboard built with Webflow and supercharged with real-time API integrations. This project demonstrates a seamless bridge between Webflow's visual design engine and live financial data.

## 🚀 Project Ecosystem
- **Live Webflow Site:** [https://cryptodashboard.webflow.io/]
- **Frontend Assets (JS/CSS):** [https://github.com/abhishek272102/crypto-dashboard]
- **Secure API Proxy:** [https://github.com/abhishek272102/crypto-proxy]

## ⚡ Key Features

### 1. Dynamic Webflow UI
- **Real-Time Data Injection:** Custom scripts fetch live market data and populate native Webflow elements instantly.
- **Interactive Visualization:** Integrated **TradingView Lightweight Charts** directly into the Webflow DOM for professional-grade market analysis.
- **Seamless State Management:** Visual "Loading," "Active," and "Error" states designed natively in Webflow and triggered programmatically.

### 2. Enterprise-Grade Architecture
- **Headless Asset Pipeline:** CSS and JavaScript are version-controlled on GitHub and served via a high-performance CDN (jsDelivr) for optimal caching and speed.
- **Secure Data Layer:** Utilizes a custom Vercel Serverless Proxy to handle API requests, ensuring API keys remain secure and hidden from the client-side.
- **Optimized Performance:** Assets are loaded asynchronously to ensure the Webflow layout paints immediately without layout shifts (CLS).

## 🛠 Tech Stack

| Category | Technology | Usage |
| :--- | :--- | :--- |
| **Frontend** | **Webflow** | Core Layout, Responsive Design, Interactions |
| **Scripting** | **Vanilla JS (ES6+)** | API Fetching, DOM Manipulation, Logic |
| **Styling** | **SCSS + Webflow** | Hybrid styling system for complex components |
| **Data** | **CoinCap API** | Live Cryptocurrency Market Data |
| **Backend** | **Node.js / Vercel** | Serverless Middleware & Security |

## 🔌 How It Works
1.  **Design:** The User Interface is crafted in Webflow using a scalable BEM class naming convention.
2.  **Fetch:** The application requests live data through the secure middleware proxy.
3.  **Render:** JavaScript targets specific Webflow IDs / Data attributes and dynamically updates the content without refreshing the page.

---
*A demonstration of high-fidelity Webflow development extended with modern web technologies.*
