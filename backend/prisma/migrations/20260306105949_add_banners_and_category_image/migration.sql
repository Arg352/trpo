BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[categories] ADD [image_url] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[promo_banners] (
    [banner_id] INT NOT NULL IDENTITY(1,1),
    [title] NVARCHAR(1000) NOT NULL,
    [subtitle] NVARCHAR(1000),
    [discount] NVARCHAR(1000),
    [image_url] NVARCHAR(1000) NOT NULL,
    [target_url] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [promo_banners_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [promo_banners_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [promo_banners_pkey] PRIMARY KEY CLUSTERED ([banner_id])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
