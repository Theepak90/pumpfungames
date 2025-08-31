# 🚀 QUICK DEPLOYMENT GUIDE - Netlify + Render (30 mins)

## 🎯 **STEP 1: Deploy Backend to Render (15 mins)**

### 1.1 Upload Project to GitHub
```bash
# First, create a new GitHub repository
# Then push your code:
git init
git add .
git commit -m "Initial deployment commit"
git remote add origin https://github.com/yourusername/pixelpal.git
git push -u origin main
```

### 1.2 Create Render Service
1. **Go to [render.com](https://render.com)** and sign up
2. **Click "New +" → "Web Service"**
3. **Connect GitHub** and select your repository
4. **Configure Service:**
   - **Name**: `pixelpal-backend`
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Root Directory**: leave blank
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 1.3 Set Environment Variables
In Render dashboard → Environment, add these:
```
NODE_ENV=production
PORT=10000
JWT_SECRET=super-secure-jwt-secret-change-this-in-production
FRONTEND_URL=https://your-app.netlify.app
LOG_LEVEL=info
```

### 1.4 Deploy & Get URL
- Click **"Create Web Service"**
- Wait 5-10 minutes for deployment
- Copy your backend URL: `https://pixelpal-backend-xxxx.onrender.com`

---

## 🌐 **STEP 2: Deploy Frontend to Netlify (15 mins)**

### 2.1 Build Frontend
```bash
cd client
npm run build
```

### 2.2 Deploy to Netlify (Drag & Drop Method)
1. **Go to [netlify.com](https://netlify.com)** and sign up
2. **Drag the `client/dist` folder** to Netlify deployment area
3. **Wait for deployment** (2-3 minutes)
4. **Copy your frontend URL**: `https://amazing-app-xxxx.netlify.app`

### 2.3 Configure Environment Variables
In Netlify dashboard → Site settings → Environment variables:
```
VITE_BACKEND_URL=https://your-render-backend-url.onrender.com
VITE_WS_URL=wss://your-render-backend-url.onrender.com/ws
```

### 2.4 Update Backend with Frontend URL
1. **Go back to Render dashboard**
2. **Environment variables**
3. **Update FRONTEND_URL** with your Netlify URL
4. **Click "Manual Deploy"** to restart

---

## ✅ **STEP 3: Test Everything (5 mins)**

### Test Backend
```bash
curl https://your-render-app.onrender.com/health
```

### Test Frontend
1. **Visit your Netlify URL**
2. **Try to register/login**
3. **Start a game**
4. **Check real-time features**

---

## 🎉 **YOU'RE LIVE!**

**Frontend**: `https://your-app.netlify.app`  
**Backend**: `https://your-render-app.onrender.com`  
**Cost**: **$0/month** (both free tiers)

---

## 🚨 **Quick Fixes for Common Issues**

### Backend won't start?
- Check Render logs for errors
- Verify build command worked
- Make sure PORT=10000 in env vars

### Frontend can't connect to backend?
- Check VITE_BACKEND_URL is correct
- Make sure CORS is configured (FRONTEND_URL)
- Verify backend is running

### CORS errors?
- Update FRONTEND_URL on Render
- Redeploy backend after environment changes

---

## 🔄 **Auto-Deploy Setup**
Both services auto-deploy when you push to GitHub main branch!