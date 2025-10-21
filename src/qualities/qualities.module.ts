import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualitiesService } from './qualities.service';
import { QualitiesController } from './qualities.controller';
import { Quality } from './entities/quality.entity';
import { QualityRepository } from './repositories/quality.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Quality])],
  controllers: [QualitiesController],
  providers: [QualitiesService, QualityRepository],
  exports: [QualitiesService],
})
export class QualitiesModule {}