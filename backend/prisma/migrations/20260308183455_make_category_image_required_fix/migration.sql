/*
  Warnings:

  - Made the column `image_url` on table `categories` required. This step will fail if there are existing NULL values in that column.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[categories] ALTER COLUMN [image_url] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[categories] ADD CONSTRAINT [categories_image_url_df] DEFAULT 'https://placehold.co/400' FOR [image_url];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
