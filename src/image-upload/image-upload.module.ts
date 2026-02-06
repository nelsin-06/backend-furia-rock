import { Module } from '@nestjs/common';
import { ImageUploadService } from './image-upload.service';
import { ImageValidatorService } from './image-validator.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  providers: [ImageUploadService, ImageValidatorService],
  exports: [ImageUploadService, ImageValidatorService],
})
export class ImageUploadModule {}
