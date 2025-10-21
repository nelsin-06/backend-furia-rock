#!/bin/bash

echo "🚀 Installing Cloudinary dependencies..."

# Install the required packages
npm install cloudinary @nestjs/serve-static multer multer-storage-cloudinary @types/multer

echo "✅ Cloudinary dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Set up your Cloudinary account at https://cloudinary.com"
echo "2. Add your Cloudinary credentials to .env file:"
echo "   CLOUDINARY_CLOUD_NAME=your_cloud_name"
echo "   CLOUDINARY_API_KEY=your_api_key"
echo "   CLOUDINARY_API_SECRET=your_api_secret"
echo "   CLOUDINARY_FOLDER=products"
echo ""
echo "3. Restart your development server:"
echo "   npm run start:dev"
