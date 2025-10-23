# Cart System - Database Schema

## Tables

### carts
```sql
CREATE TABLE carts (
  id VARCHAR(36) PRIMARY KEY,
  sessionId VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
  subtotal DECIMAL(10,2) DEFAULT 0,
  discountTotal DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cart_session (sessionId),
  INDEX idx_cart_status (status),
  INDEX idx_cart_expires (expiresAt)
);
```

### cart_items
```sql
CREATE TABLE cart_items (
  id VARCHAR(36) PRIMARY KEY,
  cartId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  INDEX idx_cart_item_cart (cartId),
  INDEX idx_cart_item_product (productId),
  FOREIGN KEY (cartId) REFERENCES carts(id) ON DELETE CASCADE
);
```

## Relationships
- Cart → has many CartItems (1:N)
- CartItem → belongs to Cart (N:1)

## API Endpoints

### GET /cart
Headers: `x-session-id: <uuid>`
Response: Cart with items

### POST /cart/items
Headers: `x-session-id: <uuid>`
Body: `{ "productId": "uuid", "quantity": 1 }`
Response: Updated cart

### PATCH /cart/items/:itemId
Headers: `x-session-id: <uuid>`
Body: `{ "quantity": 2 }`
Response: Updated cart

### DELETE /cart/items/:itemId
Headers: `x-session-id: <uuid>`
Response: Updated cart

### DELETE /cart/clear
Headers: `x-session-id: <uuid>`
Response: Empty cart

### DELETE /cart
Headers: `x-session-id: <uuid>`
Response: Success message

## Business Logic

1. **Session Management**
   - Each request must include `x-session-id` header
   - System finds or creates cart for session
   - Expired carts (expiresAt < now) are marked as abandoned

2. **Cart Expiration**
   - Default: 15 days from last interaction
   - Extended on every add/update/remove operation
   - Cleanup cron runs daily at 3:00 AM

3. **Totals Calculation**
   - ALL totals calculated server-side
   - Never trust frontend data
   - Recalculated on every cart modification:
     - subtotal = Σ(price × quantity)
     - discountTotal = Σ(discount × quantity)
     - total = subtotal - discountTotal

4. **Product Validation**
   - Verifies product exists before adding
   - Checks product is active
   - Uses current product price (not frontend price)

5. **Automatic Cleanup**
   - Cron job: Daily at 3:00 AM
   - Deletes carts where expiresAt < current time
   - Only affects 'active' status carts
