import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

/**
 * Seed runner with environment and target flags.
 *
 * Flags:
 *   --env=<development|staging|production>   (default: development)
 *   --only=<admin|colors|qualities|all>      (default: all)
 *   --update-admin-password=true             (only applies to admin seed)
 *
 * Usage examples:
 *   npm run seed:all -- --env=development
 *   npm run seed:admin -- --env=production --update-admin-password=true
 *   npm run seed:colors -- --env=staging
 *   npm run seed:qualities -- --env=production
 */

// ---------------------------------------------------------------------------
// Parse CLI flags BEFORE importing AppModule so NODE_ENV is set in time for
// ConfigModule to pick up the correct .env.<environment> file.
// ---------------------------------------------------------------------------

function parseFlags(): {
  env: string;
  only: 'admin' | 'colors' | 'qualities' | 'all';
  updateAdminPassword: boolean;
} {
  const args = process.argv.slice(2);

  const getFlag = (name: string): string | undefined => {
    const match = args.find((a) => a.startsWith(`--${name}=`));
    return match ? match.split('=').slice(1).join('=') : undefined;
  };

  const env = getFlag('env') ?? 'development';
  const rawOnly = getFlag('only') ?? 'all';
  const updateAdminPassword = getFlag('update-admin-password') === 'true';

  const validOnly = ['admin', 'colors', 'qualities', 'all'];
  if (!validOnly.includes(rawOnly)) {
    throw new Error(
      `Invalid --only value "${rawOnly}". Valid values: ${validOnly.join(', ')}`,
    );
  }

  return {
    env,
    only: rawOnly as 'admin' | 'colors' | 'qualities' | 'all',
    updateAdminPassword,
  };
}

// ---------------------------------------------------------------------------
// Set NODE_ENV before any module import so ConfigModule loads the right file.
// ---------------------------------------------------------------------------
const flags = parseFlags();
process.env.NODE_ENV = flags.env;

// Dynamic imports AFTER NODE_ENV is set.
import('dotenv').then(({ default: dotenv }) => {
  dotenv.config({ path: `.env.${flags.env}` });
});

async function runSeeds(): Promise<void> {
  const logger = new Logger('SeedRunner');

  logger.log(`Environment : ${flags.env}`);
  logger.log(`Target      : ${flags.only}`);
  if (flags.updateAdminPassword) {
    logger.log('Admin password update: ENABLED');
  }

  // Late imports to ensure NODE_ENV is already set.
  const { AppModule } = await import('../app.module');
  const { AdminRepository } = await import('../admin/repositories/admin.repository');
  const { ColorRepository } = await import('../colors/repositories/color.repository');
  const { QualityRepository } = await import('../qualities/repositories/quality.repository');
  const { seedAdmin } = await import('./admin.seed');
  const { seedColors } = await import('./colors.seed');
  const { seedQualities } = await import('./qualities.seed');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const runAdmin = flags.only === 'admin' || flags.only === 'all';
    const runColors = flags.only === 'colors' || flags.only === 'all';
    const runQualities = flags.only === 'qualities' || flags.only === 'all';

    if (runAdmin) {
      logger.log('--- Running admin seed ---');
      const adminRepository = app.get(AdminRepository);
      await seedAdmin(adminRepository, {
        updatePassword: flags.updateAdminPassword,
      });
    }

    if (runColors) {
      logger.log('--- Running colors seed ---');
      const colorRepository = app.get(ColorRepository);
      await seedColors(colorRepository);
    }

    if (runQualities) {
      logger.log('--- Running qualities seed ---');
      const qualityRepository = app.get(QualityRepository);
      await seedQualities(qualityRepository);
    }

    logger.log('Seed process finished successfully.');
  } catch (error) {
    logger.error('Seed process failed', (error as Error)?.stack);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runSeeds();
