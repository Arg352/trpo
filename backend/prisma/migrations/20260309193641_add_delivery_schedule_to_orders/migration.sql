BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[orders] ADD [delivery_date_from] DATETIME2,
[delivery_date_to] DATETIME2,
[delivery_time_slot] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
