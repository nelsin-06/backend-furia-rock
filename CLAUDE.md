# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start development server with hot reload
npm run start:dev

# Start in debug mode
npm run start:debug
```

### Building & Production
```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

### Testing
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

### Code Quality
```bash
# Lint and fix code
npm run lint

# Format code
npm run format
```

### Database
```bash
# Start MySQL container
docker compose up -d db

# View database logs
docker compose logs db

# Stop containers
docker compose down

# TypeORM CLI
npm run typeorm
```

## Architecture Overview

### Database Architecture

**Note:** Despite the docker-compose.yml showing MySQL, the application is configured to use **PostgreSQL** in production (see app.module.ts:33). The database type is set to 'postgres' with SSL support for managed databases like Neon/Heroku.

### Environment-Specific Configuration

The application uses environment-specific .env files:
- `.env.development` - Development environment
- `.env.production` - Production environment

Set `NODE_ENV` to load the appropriate configuration. The ConfigModule automatically loads `.env.${NODE_ENV}` files.

### Module Structure

The backend follows a clean **Repository Pattern** with strict dependency injection:

- **auth/** - JWT authentication with Passport strategies
- **admin/** - Admin entity and repository with bcrypt password hashing
- **products/** - Product catalog with many-to-many category relationships and quality relationships
- **categories/** - Hierarchical category system (2-level: parent/child)
- **qualities/** - Product quality/material types
- **colors/** - Product color definitions
- **cart/** - Session-based shopping cart with expiration
- **orders/** - Order management with status tracking and shipment tracking
- **payments/** - Wompi payment gateway integration with webhook signature verification
- **mail/** - Email service using Handlebars templates for order confirmations
- **telegram/** - Telegram bot notifications for order updates
- **cloudinary/** - Cloudinary image upload configuration
- **image-upload/** - Image upload service using Cloudinary

### Key Entity Relationships

**Products**:
- Many-to-many with Categories (through `product_categories` join table)
- Many-to-one with Quality
- Contains JSON field `variables` with product variants (colorId, images, variantId)

**Categories**:
- Two-level hierarchy: parent categories (parentId = null) and child categories (parentId = UUID)
- Self-referential relationship through `parentId`
- Many-to-many inverse with Products
- See CATEGORIES_API_DOCUMENTATION.md for detailed hierarchy rules

**Cart**:
- Session-based with expiration (15 minutes default)
- One-to-many with CartItems
- Three states: ACTIVE, COMPLETED, ABANDONED
- Includes subtotal, discountTotal, and total calculations

**Orders**:
- Captures complete cart snapshot at checkout time
- Includes customer_data and shipping_address as JSON
- Order status: PENDING, APPROVED, DECLINED, VOIDED, ERROR
- Tracking status: NOT_STARTED, PREPARING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED
- Links to Wompi transactions via `wompi_transaction_id`

### Application Lifecycle

On module initialization (app.module.ts:73-77), the app automatically:
1. Seeds a super admin account (from ADMIN_USERNAME/ADMIN_PASSWORD env vars)
2. Seeds default categories via CategoriesService
3. Seeds default qualities via QualitiesService

### Payment Flow (Wompi Integration)

1. **Checkout Creation** (POST /payments/checkout):
   - Validates cart items and product availability
   - Calculates prices server-side (never trusts frontend)
   - Creates order with PENDING status
   - Generates integrity signature using WOMPI_INTEGRITY_SECRET
   - Returns checkout params for Wompi Widget

2. **Webhook Processing** (POST /payments/webhook):
   - Verifies webhook signature using WOMPI_EVENTS_SECRET
   - Updates order status based on payment result
   - On APPROVED: sends Telegram notification + customer email

3. **Order Tracking**:
   - Separate tracking_status field for shipment updates
   - Admin can update tracking via orders endpoints

### Image Upload Flow

Images are uploaded to Cloudinary and stored in organized folders:
- Path structure: `products/{productId}/`
- Images are validated (type, size limit)
- Cloudinary URLs are stored in product.variables[].images

### Authentication

- JWT-based with configurable expiration (JWT_EXPIRES)
- Admin routes protected with JwtAuthGuard
- Public endpoints: product listing, categories, cart operations
- Protected endpoints: product/category CRUD, order management

## Important Implementation Notes

### Category Hierarchy Rules (CRITICAL)

Only **2 levels** allowed: parent and child categories. When implementing category features:
- Parent categories have `parentId: null`
- Child categories have `parentId: <parent-uuid>`
- Cannot create subcategory of a subcategory
- Cannot convert parent to child if it has children
- Name uniqueness validated per level (same name OK at different levels)
- GET /categories returns only parents with `children` array populated

See CATEGORIES_API_DOCUMENTATION.md for complete validation rules and API examples.

### Price Calculation Security

Always recalculate prices server-side in PaymentService.createCheckout():
- Fetch current product prices from database
- Validate all cart items exist and are active
- Calculate amount_in_cents server-side
- Never trust frontend-provided totals

### Product Variables Structure

Products use a JSON field for variants:
```typescript
{
  variantId: string;    // Generated UUID for variant
  colorId: string;      // Reference to Color entity
  images: string[];     // Cloudinary URLs
}
```

When returning to frontend, enrich with colorHex and colorName from Color entity.

### Database Synchronization

TypeORM synchronize is enabled ONLY in development mode (app.module.ts:40). In production, use migrations.

### Webhook Signature Verification

Wompi webhooks use SHA-256 signature verification:
- Extract properties specified in signature.properties
- Concatenate values + timestamp + WOMPI_EVENTS_SECRET
- Compare SHA-256 hash with received checksum
- If WOMPI_EVENTS_SECRET not set, validation is skipped with warning

## Required Environment Variables

```env
# Core
NODE_ENV=development|production
PORT=3000

# Database (PostgreSQL in production, MySQL for local dev)
DB_HOST=localhost
DB_PORT=5432  # 3306 for MySQL
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=furia_rock

# JWT
JWT_SECRET=  # Use strong secret in production
JWT_EXPIRES=5d

# Admin Seed
ADMIN_USERNAME=admin
ADMIN_PASSWORD=  # Change in production

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=products
CLOUDINARY_URL=  # Optional

# Frontend
FRONTEND_URL=  # For CORS

# Wompi Payment Gateway
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=
WOMPI_INTEGRITY_SECRET=  # For checkout signature
WOMPI_EVENTS_SECRET=  # For webhook verification
WOMPI_BASE_URL=https://production.wompi.co  # or sandbox URL
REDIRECT_URL=  # Post-payment redirect URL

# Email Service (for order confirmations)
# Add mail service environment variables as needed

# Telegram Bot (for order notifications)
# Add Telegram bot token as needed
```

## TypeScript Configuration

- Strict mode enabled
- Path aliases configured via tsconfig-paths
- Decorators enabled for NestJS metadata
- Target: ES2021

## Testing Guidelines

- Unit tests use Jest with ts-jest transformer
- Test files: `*.spec.ts`
- E2E tests: separate jest config in test/jest-e2e.json
- Coverage output: coverage/ directory
