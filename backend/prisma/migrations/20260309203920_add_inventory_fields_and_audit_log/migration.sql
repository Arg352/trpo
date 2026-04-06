BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[inventory_log] ADD [user_id] INT;

-- AlterTable
ALTER TABLE [dbo].[products] ADD [cost_price] DECIMAL(10,2),
[min_stock_level] INT NOT NULL CONSTRAINT [products_min_stock_level_df] DEFAULT 5,
[supplier] NVARCHAR(1000);

-- AddForeignKey
ALTER TABLE [dbo].[inventory_log] ADD CONSTRAINT [inventory_log_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
