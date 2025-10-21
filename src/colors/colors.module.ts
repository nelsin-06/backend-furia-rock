import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';
import { Color } from './entities/color.entity';
import { ColorRepository } from './repositories/color.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Color]),
  ],
  controllers: [ColorsController],
  providers: [ColorsService, ColorRepository],
  exports: [ColorsService, ColorRepository],
})
export class ColorsModule {}