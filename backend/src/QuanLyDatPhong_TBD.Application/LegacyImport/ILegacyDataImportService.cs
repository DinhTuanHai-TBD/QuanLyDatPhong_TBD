namespace QuanLyDatPhong_TBD.Application.LegacyImport;

public interface ILegacyDataImportService
{
    Task<LegacyImportSummary> ImportAsync(CancellationToken cancellationToken = default);
}
