"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const os = require("os");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
        exposedHeaders: ['Authorization', 'Content-Range', 'X-Content-Range'],
        credentials: false,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
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
    const getIpAddress = () => {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal)
                    return iface.address;
            }
        }
        return 'localhost';
    };
    console.log(`\n🚀 Server running on:`);
    console.log(`   - Local:   http://localhost:${port}`);
    console.log(`   - Network: http://${getIpAddress()}:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map