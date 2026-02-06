# Furia Rock Backend API

A clean, production-ready NestJS 9 backend with TypeORM, MySQL, and JWT authentication following the Repository pattern.

## Features

- 🚀 **NestJS 9** with TypeScript
- 🗄️ **TypeORM** with MySQL database
- 🔐 **JWT Authentication** for admin routes
- 📦 **Repository Pattern** with dependency injection
- 🔍 **Advanced Product Filtering & Pagination**
- 📝 **Validation** with class-validator
- 🎨 **ESLint + Prettier** configuration
- 🐳 **Docker Compose** for MySQL

## Quick Start

### Prerequisites

- Node.js 16+
- Docker & Docker Compose
- MySQL (or use Docker)

### Installation

1. **Clone and navigate to the project:**
```bash
cd /home/nelson/Documents/Diego\ Mariluz\ project/Furia\ Rock/web/backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

4. **Start MySQL database:**
```bash
docker compose up -d db
```

5. **Start the development server:**
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Auth DTOs
│   ├── guards/          # JWT Auth Guard
│   └── strategies/      # JWT Strategy
├── admin/               # Admin entity & repository
├── products/            # Products module
│   ├── dto/            # Product DTOs
│   ├── entities/       # Product entity
│   └── repositories/   # Product repository
├── image-upload/        # Image upload service (stub)
├── common/             # Shared DTOs and utilities
└── app.module.ts       # Main application module
```

## API Endpoints

### Authentication

#### Login
```http
POST /admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Change Password (Protected)
```http
POST /admin/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "admin123",
  "newPassword": "newpassword123"
}
```

### Products (Public)

#### Get Products with Filtering
```http
GET http://localhost:3000/products?page=1&limit=10
```
GET /products?page=1&limit=10&q=shirt&sort=priceAsc&category=shirt,pants&active=true
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: unlimited)
- `q` - Search by product name
- `sort` - Sort order: `priceAsc`, `priceDesc`, `dateAsc`, `dateDesc`
- `category` - Comma-separated category list
- `active` - Filter by active status (true/false)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Cool T-Shirt",
      "price": 29.99,
      "category": "shirt",
      "active": true,
      "variables": [
        {
          "colorHex": "#FF0000",
          "images": ["https://res.cloudinary.com/your-cloud/image/upload/.../image1.jpg"]
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

#### Get Single Product
```http
GET /products/:id
```

#### Create Product (Protected)
```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New T-Shirt",
  "price": 24.99,
  "category": "shirt",
  "active": true,
  "variables": [
    {
      "colorHex": "#0000FF",
      "images": []
    }
  ]
}
```

**With Image Upload:**
```http
POST /products
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Fields:
- name: "New T-Shirt"
- price: 24.99
- category: "shirt"
- active: true
- variables: [{"colorHex": "#0000FF", "images": []}]
- images: [file1.jpg, file2.jpg] (Image files)
```

#### Update Product (Protected)
```http
PATCH /products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated T-Shirt",
  "price": 19.99
}
```

#### Delete Product (Protected)
```http
DELETE /products/:id
Authorization: Bearer <token>
```

## Database Schema

### Products Table
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary Key |
| name | VARCHAR(120) | Indexed for search |
| price | DECIMAL(10,2) | Product price |
| category | VARCHAR(60) | Default: 'shirt' |
| active | BOOLEAN | Default: true |
| variables | JSON | Array of {colorHex, images[]} |
| createdAt | TIMESTAMP | Auto-generated |

### Admins Table
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary Key |
| username | VARCHAR(64) | Unique |
| passwordHash | VARCHAR(255) | Bcrypt hash |

## Environment Variables

```env
# Environment
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=furia_rock

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES=5d

# Default Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=products

# Image Upload Validation (Optional - defaults provided)
IMAGE_ASPECT_RATIO=0.7              # Target aspect ratio (7:10)
IMAGE_ASPECT_RATIO_TOLERANCE=0.05   # Tolerance (5%)
IMAGE_MIN_WIDTH=700                 # Minimum width in pixels
IMAGE_MIN_HEIGHT=1000               # Minimum height in pixels
IMAGE_MAX_WIDTH=4000                # Maximum width in pixels
IMAGE_MAX_HEIGHT=6000               # Maximum height in pixels
```

## Development Scripts

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## Docker Commands

```bash
# Start MySQL container
docker compose up -d db

# View logs
docker compose logs db

# Stop containers
docker compose down
```

## Default Admin

On first startup, a super admin is automatically created:
- **Username:** `admin` (configurable via `ADMIN_USERNAME`)
- **Password:** `admin123` (configurable via `ADMIN_PASSWORD`)

## Image Upload Service

The `ImageUploadService` is now fully integrated with **Cloudinary** for professional image management:
- `upload(file: Express.Multer.File, productId: string): Promise<string>` - Upload image to Cloudinary and return secure URL
- `remove(publicId: string): Promise<void>` - Remove image from Cloudinary

**Features:**
- Automatic folder organization by product ID
- Secure URL generation
- Image optimization and transformations available
- CDN delivery for fast loading

## Cloudinary Integration

### Image Upload Features
- **Multiple Images per Product Variable**: Each product variable can have multiple images
- **5MB File Size Limit**: Per image upload limit
- **Image Format Validation**: Only image files are accepted (JPEG, PNG, WebP)
- **Organized Storage**: Images stored in `products/{productId}/` folders
- **Automatic URL Generation**: Secure URLs returned for frontend use
- **Dimension Validation**: Images must be vertical with 7:10 aspect ratio (700×1000px minimum)
- **Automatic Optimization**: Format conversion and quality optimization via Cloudinary

### Image Specifications (Important!)

⚠️ **All product images must meet these requirements:**

- ✅ **Aspect Ratio**: 7:10 (0.7) ± 5% tolerance
- ✅ **Orientation**: Vertical (height > width)
- ✅ **Minimum Dimensions**: 700 × 1000px
- ✅ **Maximum Dimensions**: 4000 × 6000px
- ✅ **Formats**: JPEG, PNG, WebP
- ✅ **Max File Size**: 5 MB per image

**Example Valid Dimensions**:
- 700 × 1000px ✓
- 1400 × 2000px ✓
- 2100 × 3000px ✓

Images that don't meet these requirements will be **automatically rejected** with a descriptive error message.

📚 See [IMAGE_GUIDELINES.md](../IMAGE_GUIDELINES.md) for complete specifications.

### Setting Up Cloudinary
1. Create a [Cloudinary account](https://cloudinary.com)
2. Get your credentials from the dashboard
3. Add them to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=products
```

### Image Upload API
```http
POST /products
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- name: "Cool T-Shirt"
- price: 29.99
- category: "shirt"
- active: true
- variables: [{"colorHex": "#FF0000", "images": []}]
- images: [file1.jpg, file2.jpg, file3.jpg] (up to 20 images)
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Cool T-Shirt",
  "variables": [
    {
      "colorHex": "#FF0000",
      "images": ["https://res.cloudinary.com/your-cloud/image/upload/.../image1.jpg"]
    }
  ]
}
```

## Architecture Notes

- **Strict Dependency Injection:** All services use proper DI patterns
- **Repository Pattern:** Clean separation between data access and business logic
- **Environment Configuration:** All settings configurable via `.env`
- **Validation:** Input validation using class-validator decorators
- **Security:** JWT tokens, password hashing with bcrypt
- **CORS Enabled:** For frontend integration

## Testing

The project includes Jest configuration for unit and integration testing:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure `JWT_SECRET`
3. Configure proper database credentials
4. Set up reverse proxy (nginx)
5. Use PM2 or similar for process management
6. Enable SSL/TLS

## License

Private - Diego Mariluz Project
