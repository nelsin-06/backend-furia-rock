import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Design } from './entities/design.entity';
import { DesignRepository } from './repositories/design.repository';
import { DesignsService } from './designs.service';
import { DesignsController, AdminDesignsController } from './designs.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Design]),
    CloudinaryModule,
  ],
  controllers: [DesignsController, AdminDesignsController],
  providers: [DesignsService, DesignRepository],
  exports: [DesignsService, DesignRepository],
})
export class DesignsModule {}
