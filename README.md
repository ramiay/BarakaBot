# WhatsApp → AI → Instagram Bot 🤖📲📸

A minimal prototype that lets you:

1. Chat with a WhatsApp bot (via Twilio).
2. Send your business profile + a product photo.
3. Bot generates:
   - An **Instagram-ready caption** (OpenAI GPT).
   - A **designed social post image** (Node Canvas).
4. Preview is returned in WhatsApp.
5. Approve → it gets published to Instagram (Graph API).

Perfect for hackathons 🚀

---

## ⚙️ Tech Stack
- **Backend:** Node.js + Express
- **WhatsApp:** Twilio WhatsApp API
- **AI:** OpenAI GPT for captions
- **Graphics:** Node Canvas (with optional Canva API)
- **Publishing:** Instagram Graph API

---

## 📂 Project Structure

```
whatsapp-ai-bot/
├── src/
│   ├── server.js          # Entry point (Express app + routes)
│   ├── config.js          # Env vars & config loader
│   ├── state.js           # In-memory user state
│   └── utils/             # Helpers: twilio, openai, canvasGen, instagram, canva
│
├── public/
│   └── outputs/           # Generated preview images (social graphics)
│
├── fonts/                 # (optional) custom fonts for canvas
├── .env                   # environment variables (API keys, tokens)
├── package.json
└── README.md
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

System packages for **node-canvas**:
- **macOS**  
  ```bash
  brew install pkg-config cairo pango libpng jpeg giflib librsvg
  ```
- **Ubuntu/Debian**  
  ```bash
  sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev
  ```

---

### 2. Configure environment variables
Create a `.env` file in the project root:

```ini
# Server
PORT=3000
PUBLIC_BASE_URL=https://<your-ngrok-url>   # will update after ngrok

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI
OPENAI_API_KEY=sk-...

# Instagram Graph API
IG_GRAPH_API_TOKEN=EAAG...
IG_BUSINESS_ACCOUNT_ID=1784xxxxxxxxxxxxx

# Canva (optional)
USE_CANVA=0
```

---

### 3. Run the server
```bash
node src/server.js
```

Logs:
```
🚀 Server running on http://localhost:3000
```

---

### 4. Expose server publicly
Twilio & Instagram need HTTPS. Use [ngrok](https://ngrok.com/):

```bash
npx ngrok http 3000
```

It will give you a URL like:
```
Forwarding https://1234abcd.ngrok.io -> http://localhost:3000
```

Update `.env`:
```
PUBLIC_BASE_URL=https://1234abcd.ngrok.io
```

---

### 5. Configure Twilio Sandbox
1. Go to [Twilio WhatsApp Sandbox](https://www.twilio.com/console/sms/whatsapp/sandbox).
2. Set webhook:
   ```
   WHEN A MESSAGE COMES IN → POST https://1234abcd.ngrok.io/whatsapp/webhook
   ```
3. Join the sandbox (send join code to the Twilio number).

---

### 6. Instagram Graph API setup
- Use an **Instagram Business/Creator account** linked to a Facebook Page.
- Get a **long-lived access token** with `instagram_basic` and `pages_manage_posts`.
- Find your IG Business Account ID using Graph API Explorer.
- Fill these in `.env`.

---

## 💬 Usage

In WhatsApp (to Twilio sandbox number):

1. Set profile:  
   ```
   profile: Handcrafted ceramics in warm neutrals
   ```

2. Send a product photo (with optional note):  
   ```
   Stoneware mug, 12oz
   ```

3. Bot replies with:
   - AI-generated caption
   - Styled social post preview

4. Reply:
   - `approve` → publish to Instagram 🎉
   - `edit caption: Cozy mornings start here ☕ #ceramics`
   - `style: bold | minimal | pastel`

---

## 🔁 Running it every time

Each time you want to run the bot:

1. Start the server:
   ```bash
   node src/server.js
   ```
2. Start ngrok in a second terminal:
   ```bash
   npx ngrok http 3000
   ```
3. Copy the new ngrok URL → update `.env` (`PUBLIC_BASE_URL`)  
4. Update Twilio webhook to point to new URL.  
5. Start chatting in WhatsApp! ✅

---

## 🧹 Repo hygiene
- Generated images are saved in `public/outputs/`.
- Add this to `.gitignore`:
  ```
  public/outputs/*
  !public/outputs/.gitkeep
  ```
- Keep `.gitkeep` inside `outputs/` so folder exists in Git.

---

## 🎯 Hackathon Tips
- For quick demo, you can skip Instagram publishing (stop at WhatsApp preview).
- If captions feel too long/short, tweak prompt in `utils/openai.js`.
- Canva API is optional — Node Canvas already works well.

---

## 🆘 Troubleshooting
- **Images not loading in WhatsApp/Instagram** → check `PUBLIC_BASE_URL` is HTTPS & public.
- **Instagram error** → confirm your token has correct scopes & account is Business.
- **Twilio webhook not firing** → re-check ngrok URL is in sandbox settings.

---

✨ Happy hacking!
