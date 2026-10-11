-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `role` ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_sessions_refresh_token_hash_key`(`refresh_token_hash`),
    INDEX `auth_sessions_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `label` VARCHAR(60) NOT NULL,
    `recipient_name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `district` VARCHAR(100) NOT NULL,
    `village` VARCHAR(100) NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `address` TEXT NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `addresses_user_id_is_default_idx`(`user_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(2048) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_status_name_idx`(`status`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(30) NOT NULL,
    `category_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    INDEX `products_category_id_status_idx`(`category_id`, `status`),
    INDEX `products_status_name_idx`(`status`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_images_product_id_sort_order_idx`(`product_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flavors` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `flavors_slug_key`(`slug`),
    INDEX `flavors_status_name_idx`(`status`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sizes` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `unit` VARCHAR(10) NOT NULL DEFAULT 'g',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sizes_slug_key`(`slug`),
    INDEX `sizes_status_weight_grams_idx`(`status`, `weight_grams`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `flavor_id` VARCHAR(30) NOT NULL,
    `size_id` VARCHAR(30) NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `price` DECIMAL(12, 0) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `stock_on_hand` INTEGER NOT NULL DEFAULT 0,
    `reserved_stock` INTEGER NOT NULL DEFAULT 0,
    `image` VARCHAR(2048) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_variants_sku_key`(`sku`),
    INDEX `product_variants_product_id_status_idx`(`product_id`, `status`),
    INDEX `product_variants_flavor_id_size_id_status_idx`(`flavor_id`, `size_id`, `status`),
    UNIQUE INDEX `product_variants_product_id_flavor_id_size_id_key`(`product_id`, `flavor_id`, `size_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_logs` (
    `id` VARCHAR(30) NOT NULL,
    `product_variant_id` VARCHAR(30) NOT NULL,
    `type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'RESERVE', 'RELEASE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` VARCHAR(100) NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_logs_product_variant_id_created_at_idx`(`product_variant_id`, `created_at`),
    INDEX `inventory_logs_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_reservations` (
    `id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `product_variant_id` VARCHAR(30) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_reservations_status_expires_at_idx`(`status`, `expires_at`),
    UNIQUE INDEX `inventory_reservations_order_id_product_variant_id_key`(`order_id`, `product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NULL,
    `session_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `carts_user_id_key`(`user_id`),
    UNIQUE INDEX `carts_session_id_key`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` VARCHAR(30) NOT NULL,
    `cart_id` VARCHAR(30) NOT NULL,
    `product_variant_id` VARCHAR(30) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cart_items_cart_id_product_variant_id_key`(`cart_id`, `product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(30) NOT NULL,
    `order_number` VARCHAR(40) NOT NULL,
    `user_id` VARCHAR(30) NULL,
    `guest_session_id` VARCHAR(100) NULL,
    `customer_name` VARCHAR(120) NOT NULL,
    `customer_email` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(30) NOT NULL,
    `shipping_address_snapshot` JSON NOT NULL,
    `billing_address_snapshot` JSON NULL,
    `subtotal` DECIMAL(15, 0) NOT NULL,
    `discount` DECIMAL(15, 0) NOT NULL DEFAULT 0,
    `shipping_cost` DECIMAL(15, 0) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 0) NOT NULL,
    `coupon_id` VARCHAR(30) NULL,
    `coupon_code_snapshot` VARCHAR(80) NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `payment_status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `shipping_status` ENUM('PENDING', 'LABEL_CREATED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `orders_guest_session_id_idx`(`guest_session_id`),
    INDEX `orders_status_created_at_idx`(`status`, `created_at`),
    INDEX `orders_payment_status_created_at_idx`(`payment_status`, `created_at`),
    INDEX `orders_customer_email_created_at_idx`(`customer_email`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `product_variant_id` VARCHAR(30) NULL,
    `product_name` VARCHAR(180) NOT NULL,
    `flavor_name` VARCHAR(100) NOT NULL,
    `size_name` VARCHAR(100) NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `list_price` DECIMAL(12, 0) NOT NULL,
    `price` DECIMAL(12, 0) NOT NULL,
    `promotion_discount` DECIMAL(12, 0) NOT NULL DEFAULT 0,
    `promotion_name` VARCHAR(150) NULL,
    `quantity` INTEGER NOT NULL,
    `subtotal` DECIMAL(15, 0) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_variant_id_idx`(`product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `payment_method` VARCHAR(60) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `provider_transaction_id` VARCHAR(191) NULL,
    `checkout_url` VARCHAR(2048) NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 0) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `raw_response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_idempotency_key_key`(`idempotency_key`),
    INDEX `payments_order_id_status_idx`(`order_id`, `status`),
    INDEX `payments_status_expired_at_idx`(`status`, `expired_at`),
    UNIQUE INDEX `payments_provider_provider_transaction_id_key`(`provider`, `provider_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhook_events` (
    `id` VARCHAR(30) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(30) NULL,
    `raw_payload` JSON NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,

    INDEX `payment_webhook_events_processed_received_at_idx`(`processed`, `received_at`),
    UNIQUE INDEX `payment_webhook_events_provider_event_id_key`(`provider`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipments` (
    `id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `courier` VARCHAR(80) NOT NULL,
    `service` VARCHAR(80) NOT NULL,
    `tracking_number` VARCHAR(120) NULL,
    `shipping_cost` DECIMAL(15, 0) NOT NULL,
    `status` ENUM('PENDING', 'LABEL_CREATED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `shipped_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `shipments_order_id_status_idx`(`order_id`, `status`),
    INDEX `shipments_tracking_number_idx`(`tracking_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_events` (
    `id` VARCHAR(30) NOT NULL,
    `shipment_id` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'LABEL_CREATED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED') NOT NULL,
    `description` VARCHAR(500) NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shipment_events_shipment_id_occurred_at_idx`(`shipment_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupons` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `minimum_purchase` DECIMAL(15, 0) NOT NULL DEFAULT 0,
    `maximum_discount` DECIMAL(15, 0) NULL,
    `usage_limit` INTEGER NULL,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupons_code_key`(`code`),
    INDEX `coupons_status_starts_at_ends_at_idx`(`status`, `starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_redemptions` (
    `id` VARCHAR(30) NOT NULL,
    `coupon_id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `discount` DECIMAL(15, 0) NOT NULL,
    `status` ENUM('RESERVED', 'APPLIED', 'RELEASED') NOT NULL DEFAULT 'RESERVED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `coupon_redemptions_order_id_key`(`order_id`),
    INDEX `coupon_redemptions_coupon_id_status_created_at_idx`(`coupon_id`, `status`, `created_at`),
    INDEX `coupon_redemptions_user_id_coupon_id_idx`(`user_id`, `coupon_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotions` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `promotions_status_starts_at_ends_at_idx`(`status`, `starts_at`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotion_products` (
    `promotion_id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `promotion_products_product_id_idx`(`product_id`),
    PRIMARY KEY (`promotion_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_flavor_id_fkey` FOREIGN KEY (`flavor_id`) REFERENCES `flavors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_size_id_fkey` FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_webhook_events` ADD CONSTRAINT `payment_webhook_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_events` ADD CONSTRAINT `shipment_events_shipment_id_fkey` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_products` ADD CONSTRAINT `promotion_products_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_products` ADD CONSTRAINT `promotion_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE `sizes` ADD CONSTRAINT `sizes_weight_positive_ck` CHECK (`weight_grams` > 0);
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_price_nonnegative_ck` CHECK (`price` >= 0);
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_weight_positive_ck` CHECK (`weight_grams` > 0);
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_stock_nonnegative_ck` CHECK (`stock_on_hand` >= 0 AND `reserved_stock` >= 0);
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_reservation_bounds_ck` CHECK (`reserved_stock` <= `stock_on_hand`);
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_quantity_nonzero_ck` CHECK (`quantity` <> 0);
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_quantity_positive_ck` CHECK (`quantity` > 0);
-- carts_exactly_one_owner_ck omitted: MySQL 8.4 does not permit CHECK constraints referencing columns with FK referential actions (ON DELETE CASCADE)
-- ALTER TABLE `carts` ADD CONSTRAINT `carts_exactly_one_owner_ck` CHECK ((`user_id` IS NOT NULL AND `session_id` IS NULL) OR (`user_id` IS NULL AND `session_id` IS NOT NULL));
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_quantity_positive_ck` CHECK (`quantity` > 0);
ALTER TABLE `orders` ADD CONSTRAINT `orders_amounts_nonnegative_ck` CHECK (`subtotal` >= 0 AND `discount` >= 0 AND `shipping_cost` >= 0 AND `total` >= 0);
ALTER TABLE `orders` ADD CONSTRAINT `orders_discount_within_subtotal_ck` CHECK (`discount` <= `subtotal`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_total_matches_components_ck` CHECK (`total` = `subtotal` - `discount` + `shipping_cost`);
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_amounts_positive_ck` CHECK (`price` >= 0 AND `quantity` > 0 AND `subtotal` = `price` * `quantity`);
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_promotion_price_ck` CHECK (`list_price` >= `price` AND `promotion_discount` = `list_price` - `price`);
ALTER TABLE `payments` ADD CONSTRAINT `payments_amount_nonnegative_ck` CHECK (`amount` >= 0);
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_shipping_cost_nonnegative_ck` CHECK (`shipping_cost` >= 0);
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_value_and_usage_ck` CHECK (`value` >= 0 AND (`type` <> 'PERCENTAGE' OR `value` <= 100) AND `minimum_purchase` >= 0 AND (`maximum_discount` IS NULL OR `maximum_discount` >= 0) AND (`usage_limit` IS NULL OR (`usage_limit` >= 0 AND `used_count` <= `usage_limit`)) AND `used_count` >= 0);
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_date_range_ck` CHECK (`starts_at` < `ends_at`);
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_discount_nonnegative_ck` CHECK (`discount` >= 0);
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_value_ck` CHECK (`value` >= 0 AND (`type` <> 'PERCENTAGE' OR `value` <= 100));
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_date_range_ck` CHECK (`starts_at` < `ends_at`);
