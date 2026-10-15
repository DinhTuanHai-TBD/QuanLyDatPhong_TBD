namespace QuanLyDatPhong_TBD.Application.LegacyImport;

public sealed record LegacyImportSummary(bool Succeeded, string Message, int Users, int Roles, int Rooms, int Equipments, int Bookings, int RoomEquipments, int Penalties, int AuditLogs);
