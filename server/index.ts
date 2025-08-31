import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./simple-routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// CORS middleware - production ready
app.use((req, res, next) => {
  // In production, allow specific origins or use environment variable
  const allowedOrigins = isProduction 
    ? [process.env.FRONTEND_URL || 'http://localhost:3000']
    : ['*'];
  
  const origin = req.get('origin');
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Production logging - less verbose in production
if (isDevelopment) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.get('origin') || 'unknown'}`);
    next();
  });
}

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && isDevelopment) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoint for AWS load balancer
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

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
      message: isProduction ? 'Internal Server Error' : message,
      ...(isDevelopment && { stack: err.stack })
    });
    
    if (isDevelopment) {
      throw err;
    }
  });

  // Setup Vite only in development, but AFTER API routes
  if (isDevelopment) {
    // API routes are already registered above, so Vite won't override them
    await setupVite(app, server);
  } else {
    // In production, serve static files from build directory
    serveStatic(app);
  }

  // Port configuration - use 5174 for development, 3000 for production
  const port = parseInt(process.env.PORT || (isProduction ? '3000' : '5174'), 10);
  const host = isProduction ? '0.0.0.0' : 'localhost';

  server.listen(port, host, () => {
    log(`🚀 Server running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    log(`🌐 Server listening on ${host}:${port}`);
    log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    if (isProduction) {
      log(`📊 Health check available at: http://localhost:${port}/health`);
    }
  });
})();
