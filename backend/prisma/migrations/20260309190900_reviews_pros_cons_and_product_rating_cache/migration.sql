/*
  Warnings:

  - You are about to drop the column `comment` on the `reviews` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[products] ADD [average_rating] FLOAT(53) NOT NULL CONSTRAINT [products_average_rating_df] DEFAULT 0,
[review_count] INT NOT NULL CONSTRAINT [products_review_count_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[reviews] DROP COLUMN [comment];
ALTER TABLE [dbo].[reviews] ADD [cons] NVARCHAR(1000),
[pros] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
