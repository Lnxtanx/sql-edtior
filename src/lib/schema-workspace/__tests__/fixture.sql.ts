/**
 * Shared SQL fixture for schema-workspace tests.
 * Contains every edge case: SET search_path, FKs, self-referential FK,
 * views, materialized views, view→view chain, triggers, policies, indexes.
 */
export const TEST_SQL = `
SET search_path TO demo;

CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user'
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total NUMERIC(10,2) DEFAULT 0,
    status order_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders SET total = (
        SELECT COALESCE(SUM(price * quantity), 0) FROM order_items WHERE order_id = NEW.order_id
    ) WHERE id = NEW.order_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_total();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_owner_policy ON orders
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

CREATE VIEW user_order_summary AS
SELECT u.id AS user_id, u.name, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name;

CREATE MATERIALIZED VIEW product_sales_summary AS
SELECT oi.product_name, SUM(oi.quantity) AS total_qty, SUM(oi.price * oi.quantity) AS revenue
FROM order_items oi
GROUP BY oi.product_name;

CREATE UNIQUE INDEX idx_product_sales_summary_product ON product_sales_summary(product_name);

CREATE VIEW top_customers AS
SELECT * FROM user_order_summary WHERE order_count > 5;
`;
