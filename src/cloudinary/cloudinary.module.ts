import { Module } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinarySignatureService } from './cloudinary-signature.service';
import { CloudinarySignatureController } from './cloudinary-signature.controller';

@Module({
  controllers: [CloudinarySignatureController],
  providers: [
    {
      provide: 'CLOUDINARY',
      useFactory: () => {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        return cloudinary;
      },
    },
    CloudinarySignatureService,
  ],
  exports: ['CLOUDINARY', CloudinarySignatureService],
})
export class CloudinaryModule {}
