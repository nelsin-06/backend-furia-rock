import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { AdminRepository } from './admin/repositories/admin.repository';
import { QualitiesService } from './qualities/qualities.service';
import { ColorsService } from './colors/colors.service';

/**
 * Standalone seed script.
 *
 * Creates a NestJS application context (no HTTP server) and runs all
 * seed routines:
 *   1. Super admin account (from ADMIN_USERNAME / ADMIN_PASSWORD env vars)
 *   2. Default quality tiers (dtf, dtg)
 *   3. Default colors
 *
 * All seeds are idempotent — safe to run multiple times.
 *
 * Usage:
 *   npm run seed          # after "npm run build"
 *   npm run seed:dev      # compiles + seeds in one step
 */
async function runSeeds(): Promise<void> {
  const logger = new Logger('Seed');

  logger.log('Starting seed process...');

  // Create application context (no HTTP listener)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    // --- 1. Seed super admin ---
    const adminRepository = app.get(AdminRepository);
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      logger.warn(
        'ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping super admin seed.',
      );
    } else {
      const existingAdmin =
        await adminRepository.findByUsername(adminUsername);

      if (existingAdmin) {
        logger.log(`Super admin "${adminUsername}" already exists — skipped.`);
      } else {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        const admin = adminRepository.create({
          username: adminUsername,
          passwordHash,
        });
        await adminRepository.save(admin);
        logger.log(`Super admin created with username: ${adminUsername}`);
      }
    }

    // --- 2. Seed default qualities ---
    const qualitiesService = app.get(QualitiesService);
    try {
      await qualitiesService.seedDefaultQualities();
      logger.log('Default qualities seed completed.');
    } catch (error) {
      logger.error('Error seeding default qualities', error?.stack);
    }

    // --- 3. Seed default colors ---
    const colorsService = app.get(ColorsService);
    try {
      await colorsService.seedDefaultColors();
      logger.log('Default colors seed completed.');
    } catch (error) {
      logger.error('Error seeding default colors', error?.stack);
    }

    logger.log('Seed process finished successfully.');
  } catch (error) {
    logger.error('Seed process failed', error?.stack);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runSeeds();
