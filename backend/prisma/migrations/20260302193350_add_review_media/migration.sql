BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[review_media] (
    [media_id] INT NOT NULL IDENTITY(1,1),
    [review_id] INT NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [review_media_pkey] PRIMARY KEY CLUSTERED ([media_id])
);

-- AddForeignKey
ALTER TABLE [dbo].[review_media] ADD CONSTRAINT [review_media_review_id_fkey] FOREIGN KEY ([review_id]) REFERENCES [dbo].[reviews]([review_id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
