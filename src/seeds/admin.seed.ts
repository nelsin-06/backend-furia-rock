import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminRepository } from '../admin/repositories/admin.repository';

const logger = new Logger('AdminSeed');

export interface AdminSeedOptions {
  updatePassword?: boolean;
}

export async function seedAdmin(
  adminRepository: AdminRepository,
  options: AdminSeedOptions = {},
): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    logger.warn(
      'ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping admin seed.',
    );
    return;
  }

  const existingAdmin = await adminRepository.findByUsername(username);

  if (existingAdmin) {
    if (options.updatePassword) {
      const passwordHash = await bcrypt.hash(password, 10);
      await adminRepository.updatePassword(existingAdmin.id, passwordHash);
      logger.log(`Admin "${username}" password updated successfully.`);
    } else {
      logger.log(
        `Admin "${username}" already exists — skipped. Use --update-admin-password=true to update password.`,
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = adminRepository.create({ username, passwordHash });
  await adminRepository.save(admin);
  logger.log(`Admin "${username}" created successfully.`);
}
