# 🚀 Netlify + Render Deployment Guide

## 📋 Overview

This guide will help you deploy:
- **Frontend**: React app on Netlify (free tier)
- **Backend**: Node.js server on Render (free tier)
- **Real-time**: WebSocket connections between them

## 🔧 Step 1: Deploy Backend to Render

### 1.1 Prepare Your Project for Git
```bash
cd "/Users/theepak/Downloads/PixelPal 3"

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit for Render deployment"

# Push to GitHub (create a new repository first)
# git remote add origin https://github.com/yourusername/pixelpal.git
# git push -u origin main
```

### 1.2 Create Render Service
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `pixelpal-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 1.3 Set Environment Variables on Render
In your Render dashboard, go to Environment and add:
```
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secure-jwt-secret-key-here
FRONTEND_URL=https://your-app.netlify.app
LOG_LEVEL=info
ETHERSCAN_API_KEY=your-etherscan-api-key
BLOCKCYPHER_API_KEY=your-blockcypher-api-key
```

### 1.4 Deploy and Get Your Render URL
- Click "Create Web Service"
- Wait for deployment (5-10 minutes)
- Your backend will be available at: `https://pixelpal-backend-xxxx.onrender.com`

## 🌐 Step 2: Deploy Frontend to Netlify

### 2.1 Build the Frontend
```bash
cd client
npm run build
```

### 2.2 Deploy to Netlify

#### Option A: Drag & Drop (Easiest)
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `client/dist` folder to the deployment area
3. Your site will be deployed instantly!

#### Option B: Git Integration (Recommended)
1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure build settings:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`

### 2.3 Configure Environment Variables on Netlify
In Netlify dashboard, go to Site settings → Environment variables:
```
VITE_BACKEND_URL=https://your-render-app.onrender.com
VITE_WS_URL=wss://your-render-app.onrender.com/ws
```

### 2.4 Update Netlify Configuration
The `client/netlify.toml` file needs to be updated with your Render URL:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

# SPA routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = true

# API proxy to Render backend
[[redirects]]
  from = "/api/*"
  to = "https://your-render-app.onrender.com/api/:splat"
  status = 200
  force = true

# WebSocket proxy
[[redirects]]
  from = "/ws"
  to = "https://your-render-app.onrender.com/ws"
  status = 200
  force = true
```

## 🧪 Step 3: Test the Complete System

### 3.1 Test Backend
```bash
# Test health endpoint
curl https://your-render-app.onrender.com/health

# Test API
curl https://your-render-app.onrender.com/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### 3.2 Test Frontend
1. Visit your Netlify URL: `https://your-app.netlify.app`
2. Try to register/login
3. Start a game and check real-time features

## 🔧 Important Notes

### Render Free Tier Limitations
- **Sleep after 15 minutes** of inactivity
- **750 hours/month** (enough for 24/7 if it's your only service)
- **First request after sleep takes 30-60 seconds**
- **512MB RAM limit**

### Netlify Free Tier Limitations
- **100GB bandwidth/month**
- **300 build minutes/month**
- **1000 form submissions/month**

## 🚨 Troubleshooting

### Backend Issues
- **Cold starts**: First request after sleep is slow
- **Memory limits**: Optimize your code if hitting 512MB
- **Build failures**: Check logs in Render dashboard

### Frontend Issues
- **CORS errors**: Make sure FRONTEND_URL is set correctly on Render
- **API calls failing**: Verify VITE_BACKEND_URL environment variable
- **Build failures**: Check Node.js version in Netlify settings

## ✅ Success Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Netlify
- [ ] Environment variables configured
- [ ] API calls working
- [ ] WebSocket connections active
- [ ] Authentication functional
- [ ] Game features working

## 🎉 You're Live!

Your PixelPal game is now running on:
- **Frontend**: `https://your-app.netlify.app`
- **Backend**: `https://your-render-app.onrender.com`
- **Cost**: $0/month (both free tiers)!

## 🔄 Automatic Deployments

- **Netlify**: Automatically deploys on Git push
- **Render**: Automatically deploys on Git push
- Both services watch your main branch for changes