-- ==============================================================================
-- Easy Monitor E-Commerce Mock Cluster SQL Seeding Script
-- ==============================================================================

-- ─── Products Table ───
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (id, name, description, category) VALUES
    ('electronics', 'High-End Wireless Headphones', 'Noise-canceling over-ear headphones', 'audio'),
    ('clothing', 'Organic Cotton T-Shirt', 'Breathable and classic fit', 'apparel'),
    ('books', 'Clean Code', 'A Handbook of Agile Software Craftsmanship', 'literature'),
    ('home', 'Smart Home Hub', 'Control all your devices centrally', 'electronics')
ON CONFLICT DO NOTHING;

-- ─── Pricing Table ───
CREATE TABLE IF NOT EXISTS pricing (
    product_id VARCHAR(50) PRIMARY KEY,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    discount_pct DECIMAL(5, 2) DEFAULT 0.00
);

INSERT INTO pricing (product_id, price, currency) VALUES
    ('electronics', 299.99, 'USD'),
    ('clothing', 29.99, 'USD'),
    ('books', 45.00, 'USD'),
    ('home', 149.99, 'USD')
ON CONFLICT DO NOTHING;

-- ─── Inventory Table ───
CREATE TABLE IF NOT EXISTS inventory (
    product_id VARCHAR(50) PRIMARY KEY,
    stock_qty INT DEFAULT 0,
    warehouse_location VARCHAR(100)
);

INSERT INTO inventory (product_id, stock_qty, warehouse_location) VALUES
    ('electronics', 45, 'US-WEST-1'),
    ('clothing', 210, 'US-EAST-2'),
    ('books', 18, 'EU-CENTRAL'),
    ('home', 8, 'US-WEST-1')
ON CONFLICT DO NOTHING;

-- ─── Users Table ───
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- ==============================================================================
-- Note: 'order_orders' and 'payment_transactions' are automatically generated 
-- by Spring Data JPA (Hibernate) and TypeORM respectively via DDL sync.
-- ==============================================================================
