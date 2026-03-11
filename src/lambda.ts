import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import { Callback, Context, Handler } from 'aws-lambda';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

// Cached handler for warm Lambda starts — app is created once and reused
let cachedServer: Handler;

async function bootstrapLambda(): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter);

  // Apply shared configuration (prefix, pipes, CORS, Swagger)
  await configureApp(app);

  // Initialize app without opening a port
  await app.init();

  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  // Prevent Lambda from waiting for empty event loop (keeps DB connections alive)
  context.callbackWaitsForEmptyEventLoop = false;

  // Reuse the cached NestJS app across warm invocations
  if (!cachedServer) {
    cachedServer = await bootstrapLambda();
  }

  return cachedServer(event, context, callback);
};
