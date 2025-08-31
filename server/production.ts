import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./simple-routes";

const app = express();

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';

// CORS middleware - production ready
app.use((req, res, next) => {
  // In production, allow Netlify domain and specific origins
  const allowedOrigins = isProduction 
    ? [
        process.env.FRONTEND_URL || 'https://your-app.netlify.app',
        'https://your-app.netlify.app',
        'http://localhost:3000' // For local testing
      ]
    : ['*'];
  
  const origin = req.get('origin');
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Health check endpoint for AWS load balancer
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Serve static files from public directory
app.use(express.static('public'));

(async () => {
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log errors in production
    if (isProduction) {
      console.error('Production error:', err);
    }

    res.status(status).json({ 
      message: isProduction ? 'Internal Server Error' : message
    });
  });

  // Production port configuration
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = '0.0.0.0'; // Listen on all interfaces for production

  server.listen(port, host, () => {
    console.log(`🚀 Server running in PRODUCTION mode`);
    console.log(`🌐 Server listening on ${host}:${port}`);
    console.log(`🔗 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`📊 Health check available at: http://localhost:${port}/health`);
  });
})(); 