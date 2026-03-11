import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Apply shared configuration (prefix, pipes, CORS, Swagger)
  await configureApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);

  if (
    process.env.ENABLE_SWAGGER === 'true' ||
    (!process.env.ENABLE_SWAGGER && process.env.NODE_ENV !== 'production')
  ) {
    logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
