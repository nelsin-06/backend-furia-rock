import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';

@Injectable()
export class AdminRepository {
  constructor(
    @InjectRepository(Admin)
    private readonly repository: Repository<Admin>,
  ) {}

  findByUsername(username: string): Promise<Admin | null> {
    return this.repository.findOne({ where: { username } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repository.update(id, { passwordHash });
  }

  findOne(options: any): Promise<Admin | null> {
    return this.repository.findOne(options);
  }

  create(entityLike: Partial<Admin>): Admin {
    return this.repository.create(entityLike);
  }

  save(entity: Admin): Promise<Admin> {
    return this.repository.save(entity);
  }
}
