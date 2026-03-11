import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const logger = new Logger('Bootstrap');

/**
 * Shared application configuration applied in both local server (main.ts)
 * and Lambda handler (lambda.ts) to ensure consistency.
 */
export async function configureApp(app: INestApplication): Promise<void> {
  // Global route prefix — all routes start with /api
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — open for now (will be tightened for production later)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger / OpenAPI — only when ENABLE_SWAGGER env var is 'true'
  const enableSwagger =
    process.env.ENABLE_SWAGGER === 'true' ||
    // Fallback: enable in development if ENABLE_SWAGGER is not explicitly set
    (!process.env.ENABLE_SWAGGER && process.env.NODE_ENV !== 'production');

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Furia Rock API')
      .setDescription(
        'API documentation for the Furia Rock e-commerce backend',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs enabled at /api/docs');
  } else {
    logger.log('Swagger docs disabled (ENABLE_SWAGGER is not true)');
  }
}
