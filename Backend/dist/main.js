"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    console.log('Configuring CORS for development environment');
    const allowedOrigins = [
        'http://localhost:4200',
        'http://localhost:3000',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:3000',
        'https://www.quiztn.com',
        'https://quiztn.com',
        'http://51.38.234.49'
    ];
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.some(allowedOrigin => origin === allowedOrigin ||
                origin.startsWith(`http://localhost:`) ||
                origin.startsWith(`https://localhost:`))) {
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
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Quiz')
        .setDescription('The best API documentation ever!')
        .setVersion('1.0.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT || 3001;
    const server = await app.listen(port, '0.0.0.0');
    const address = server.address();
    const host = address.address === '::' ? 'localhost' : address.address;
    console.log(`\n🚀 Server running on:`);
    console.log(`   - Local:   http://localhost:${port}`);
    console.log(`   - Network: http://${require('os').hostname()}.local:${port}`);
    console.log(`   - Network: http://${getIpAddress()}:${port}`);
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
//# sourceMappingURL=main.js.map