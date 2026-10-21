
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }),
  );

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS for Expo Web and React Native development
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:8081,http://127.0.0.1:8081')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
    methods: [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Tenant-Id',
      'X-Company-Id',
      'X-Branch-Id',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // Allow access from other devices on your network
  const port = Number(process.env.PORT || 4000);

  await app.listen(port, '0.0.0.0');

  console.log(
    `BranchSuite Backend running on port ${port}`,
  );
}

void bootstrap();
