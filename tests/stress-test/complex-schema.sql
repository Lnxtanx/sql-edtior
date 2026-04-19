-- Complex Schema for Path Analysis & Impact Stats Verification

-- 1. Core Users & Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE auth_identities (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    provider VARCHAR(20),
    provider_id VARCHAR(100),
    last_login TIMESTAMP
);

-- 2. E-commerce Core
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10, 2),
    stock INT
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    status VARCHAR(20),
    total DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT,
    price DECIMAL(10, 2)
);

-- 3. Views (Layer 1)
CREATE VIEW user_order_stats AS
SELECT 
    u.id AS user_id,
    u.username,
    COUNT(o.id) AS total_orders,
    SUM(o.total) AS lifetime_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username;

-- 4. Views (Layer 2 - Dependent on View)
CREATE VIEW high_value_users AS
SELECT * 
FROM user_order_stats
WHERE lifetime_value > 1000;

-- 5. Triggers
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    record_id INT,
    action VARCHAR(20),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_order_change() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action)
    VALUES ('orders', NEW.id, TG_OP);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_audit
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_change();

-- 6. Trigger Dependency chain
-- Function calling another table explicitly
CREATE OR REPLACE FUNCTION update_stock() RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reduce_stock
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION update_stock();
