namespace QuanLyDatPhong_TBD.Infrastructure.LegacyImport;

public sealed class LegacyImportOptions
{
    public const string SectionName = "LegacyImport";
    public string? SqlServerConnection { get; init; }
}
