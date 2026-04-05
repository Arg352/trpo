BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[product_images] (
    [image_id] INT NOT NULL IDENTITY(1,1),
    [product_id] INT NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [is_main] BIT NOT NULL CONSTRAINT [product_images_is_main_df] DEFAULT 0,
    [sort_order] INT NOT NULL CONSTRAINT [product_images_sort_order_df] DEFAULT 0,
    CONSTRAINT [product_images_pkey] PRIMARY KEY CLUSTERED ([image_id])
);

-- AddForeignKey
ALTER TABLE [dbo].[product_images] ADD CONSTRAINT [product_images_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[products]([product_id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
