import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as socketIo from 'socket.io';
import { Server } from 'http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cors = require('cors');
  // Enable CORS for HTTP requests
  // In development, allow all origins for easier debugging
  console.log('Running in development mode - using permissive CORS settings');
  app.enableCors({
    origin: true,  // Allow all origins in development
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  // Log CORS settings
  console.log('CORS enabled for all origins in development mode');
  
  // For development, allow all origins
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  console.log('CORS configured to allow all origins');
  
  // Production CORS settings (commented out for now)
  // if (process.env.NODE_ENV === 'production') {
    // Production CORS settings (example)
    /*
    const allowedOrigins = [
      'https://yourapp.com',  // Replace with your production domain
    ];

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn(`CORS blocked: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204
    });
    */
  // }

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Quiz')
    .setDescription('The best API documentation ever!')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Validation pipes for incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(cors());

  // Initialize Socket.io with CORS configuration for WebSocket connections

  // WebSocket event handling

  // Start the NestJS HTTP server
  // Listen on all network interfaces (0.0.0.0) for external access
  const port = process.env.PORT || 3001;
  const server = await app.listen(port, '0.0.0.0');
  
  // Get the actual address and port
  const address = server.address();
  const host = address.address === '::' ? 'localhost' : address.address;
  
  console.log(`\n🚀 Server running on:`);
  console.log(`   - Local:   http://localhost:${port}`);
  console.log(`   - Network: http://${require('os').hostname()}.local:${port}`);
  console.log(`   - Network: http://${getIpAddress()}:${port}`);
  
  // Function to get local IP address
  function getIpAddress() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        const { address, family, internal } = iface;
        if (family === 'IPv4' && !internal) {
          return address;
        }
      }
    }
    return 'localhost';
  }
}
bootstrap();
