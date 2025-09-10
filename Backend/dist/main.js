"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const cors = require('cors');
    console.log('Running in development mode - using permissive CORS settings');
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        preflightContinue: false,
        optionsSuccessStatus: 204
    });
    console.log('CORS enabled for all origins in development mode');
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
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Quiz')
        .setDescription('The best API documentation ever!')
        .setVersion('1.0.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.use(cors());
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