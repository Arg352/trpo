BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [role_id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([role_id]),
    CONSTRAINT [roles_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[responsibilities] (
    [responsibility_id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [responsibilities_pkey] PRIMARY KEY CLUSTERED ([responsibility_id]),
    CONSTRAINT [responsibilities_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [user_id] INT NOT NULL IDENTITY(1,1),
    [role_id] INT NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [username] NVARCHAR(1000) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [first_name] NVARCHAR(1000) NOT NULL,
    [last_name] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [users_status_df] DEFAULT 'active',
    [mobile_push_token] NVARCHAR(1000),
    [notifications_enabled] BIT CONSTRAINT [users_notifications_enabled_df] DEFAULT 1,
    [created_at] DATETIME2 CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([user_id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [users_username_key] UNIQUE NONCLUSTERED ([username])
);

-- CreateTable
CREATE TABLE [dbo].[user_responsibilities] (
    [user_id] INT NOT NULL,
    [responsibility_id] INT NOT NULL,
    CONSTRAINT [user_responsibilities_pkey] PRIMARY KEY CLUSTERED ([user_id],[responsibility_id])
);

-- CreateTable
CREATE TABLE [dbo].[saved_addresses] (
    [address_id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [city] NVARCHAR(1000) NOT NULL,
    [address_text] NVARCHAR(1000) NOT NULL,
    [is_default] BIT CONSTRAINT [saved_addresses_is_default_df] DEFAULT 0,
    CONSTRAINT [saved_addresses_pkey] PRIMARY KEY CLUSTERED ([address_id])
);

-- CreateTable
CREATE TABLE [dbo].[saved_cards] (
    [card_id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [brand] NVARCHAR(1000) NOT NULL,
    [last_4_digits] NVARCHAR(1000) NOT NULL,
    [card_holder_name] NVARCHAR(1000),
    [payment_token] NVARCHAR(1000),
    [is_default] BIT CONSTRAINT [saved_cards_is_default_df] DEFAULT 0,
    [created_at] DATETIME2 CONSTRAINT [saved_cards_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [saved_cards_pkey] PRIMARY KEY CLUSTERED ([card_id])
);

-- CreateTable
CREATE TABLE [dbo].[categories] (
    [category_id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [categories_pkey] PRIMARY KEY CLUSTERED ([category_id]),
    CONSTRAINT [categories_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [categories_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[attributes] (
    [attribute_id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000),
    CONSTRAINT [attributes_pkey] PRIMARY KEY CLUSTERED ([attribute_id])
);

-- CreateTable
CREATE TABLE [dbo].[category_attributes] (
    [category_id] INT NOT NULL,
    [attribute_id] INT NOT NULL,
    CONSTRAINT [category_attributes_pkey] PRIMARY KEY CLUSTERED ([category_id],[attribute_id])
);

-- CreateTable
CREATE TABLE [dbo].[products] (
    [product_id] INT NOT NULL IDENTITY(1,1),
    [category_id] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [price] DECIMAL(10,2) NOT NULL CONSTRAINT [products_price_df] DEFAULT 0,
    [stock_quantity] INT NOT NULL CONSTRAINT [products_stock_quantity_df] DEFAULT 0,
    [image_url] NVARCHAR(1000),
    [sku] NVARCHAR(1000),
    [is_active] BIT CONSTRAINT [products_is_active_df] DEFAULT 1,
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([product_id]),
    CONSTRAINT [products_sku_key] UNIQUE NONCLUSTERED ([sku])
);

-- CreateTable
CREATE TABLE [dbo].[product_attribute_values] (
    [product_id] INT NOT NULL,
    [attribute_id] INT NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [product_attribute_values_pkey] PRIMARY KEY CLUSTERED ([product_id],[attribute_id])
);

-- CreateTable
CREATE TABLE [dbo].[inventory_log] (
    [log_id] INT NOT NULL IDENTITY(1,1),
    [product_id] INT NOT NULL,
    [change_amount] INT NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [inventory_log_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [inventory_log_pkey] PRIMARY KEY CLUSTERED ([log_id])
);

-- CreateTable
CREATE TABLE [dbo].[orders] (
    [order_id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [delivery_type] NVARCHAR(1000) NOT NULL,
    [delivery_address] NVARCHAR(1000),
    [status] NVARCHAR(1000) CONSTRAINT [orders_status_df] DEFAULT 'cart',
    [total_amount] DECIMAL(12,2) NOT NULL CONSTRAINT [orders_total_amount_df] DEFAULT 0,
    [created_at] DATETIME2 CONSTRAINT [orders_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [orders_pkey] PRIMARY KEY CLUSTERED ([order_id])
);

-- CreateTable
CREATE TABLE [dbo].[order_items] (
    [item_id] INT NOT NULL IDENTITY(1,1),
    [order_id] INT NOT NULL,
    [product_id] INT NOT NULL,
    [quantity] INT NOT NULL,
    [price_at_moment] DECIMAL(10,2) NOT NULL,
    CONSTRAINT [order_items_pkey] PRIMARY KEY CLUSTERED ([item_id])
);

-- CreateTable
CREATE TABLE [dbo].[payments] (
    [payment_id] INT NOT NULL IDENTITY(1,1),
    [order_id] INT NOT NULL,
    [transaction_uuid] NVARCHAR(1000),
    [payment_method] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [payments_status_df] DEFAULT 'success',
    [payment_date] DATETIME2 CONSTRAINT [payments_payment_date_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [payments_pkey] PRIMARY KEY CLUSTERED ([payment_id])
);

-- CreateTable
CREATE TABLE [dbo].[reviews] (
    [review_id] INT NOT NULL IDENTITY(1,1),
    [product_id] INT NOT NULL,
    [user_id] INT NOT NULL,
    [rating] INT NOT NULL,
    [comment] NVARCHAR(1000),
    [created_at] DATETIME2 CONSTRAINT [reviews_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [reviews_pkey] PRIMARY KEY CLUSTERED ([review_id])
);

-- CreateTable
CREATE TABLE [dbo].[chat_messages] (
    [message_id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [chat_with_user_id] INT NOT NULL,
    [text] NVARCHAR(1000) NOT NULL,
    [is_read] BIT CONSTRAINT [chat_messages_is_read_df] DEFAULT 0,
    [created_at] DATETIME2 CONSTRAINT [chat_messages_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [chat_messages_pkey] PRIMARY KEY CLUSTERED ([message_id])
);

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([role_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[user_responsibilities] ADD CONSTRAINT [user_responsibilities_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[user_responsibilities] ADD CONSTRAINT [user_responsibilities_responsibility_id_fkey] FOREIGN KEY ([responsibility_id]) REFERENCES [dbo].[responsibilities]([responsibility_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[saved_addresses] ADD CONSTRAINT [saved_addresses_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[saved_cards] ADD CONSTRAINT [saved_cards_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[category_attributes] ADD CONSTRAINT [category_attributes_category_id_fkey] FOREIGN KEY ([category_id]) REFERENCES [dbo].[categories]([category_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[category_attributes] ADD CONSTRAINT [category_attributes_attribute_id_fkey] FOREIGN KEY ([attribute_id]) REFERENCES [dbo].[attributes]([attribute_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_category_id_fkey] FOREIGN KEY ([category_id]) REFERENCES [dbo].[categories]([category_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[product_attribute_values] ADD CONSTRAINT [product_attribute_values_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([product_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[product_attribute_values] ADD CONSTRAINT [product_attribute_values_attribute_id_fkey] FOREIGN KEY ([attribute_id]) REFERENCES [dbo].[attributes]([attribute_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[inventory_log] ADD CONSTRAINT [inventory_log_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([product_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[orders] ADD CONSTRAINT [orders_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [order_items_order_id_fkey] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders]([order_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [order_items_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([product_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_order_id_fkey] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders]([order_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([product_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[chat_messages] ADD CONSTRAINT [chat_messages_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[chat_messages] ADD CONSTRAINT [chat_messages_chat_with_user_id_fkey] FOREIGN KEY ([chat_with_user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
