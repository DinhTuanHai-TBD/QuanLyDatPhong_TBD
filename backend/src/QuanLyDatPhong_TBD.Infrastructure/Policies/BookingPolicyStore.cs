using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Infrastructure.Policies;

public sealed class BookingPolicyStore(ApplicationDbContext db)
{
    public async Task<BookingSetting> GetAsync(CancellationToken token) =>
        await db.BookingSettings.AsNoTracking().OrderBy(x => x.Id).FirstOrDefaultAsync(token)
        ?? new BookingSetting { Id = 1 };
}
