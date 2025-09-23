import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as socketIo from 'socket.io';
import { Server } from 'http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for HTTP requests
  console.log('Configuring CORS for development environment');
  
  const allowedOrigins = [
    // Development
    'http://localhost:4200',
    'http://localhost:3000',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:3000',
    // Production
    'https://www.quiztn.com',
    'https://quiztn.com',
    'http://51.38.234.49'
  ];
  
  // Enable CORS with security headers
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(allowedOrigin => 
        origin === allowedOrigin || 
        origin.startsWith(`http://localhost:`) ||
        origin.startsWith(`https://localhost:`)
      )) {
        return callback(null, true);
      }
      console.warn(`CORS blocked: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization', 'Content-Range', 'X-Content-Range'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  console.log('CORS configured for frontend access');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Quiz')
    .setDescription('The best API documentation ever!')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Validation pipes for incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

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
