using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuanLyDatPhong_TBD.Application.LegacyImport;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/legacy-import")]
public sealed class LegacyImportController : ControllerBase
{
    private readonly ILegacyDataImportService _service;

    public LegacyImportController(ILegacyDataImportService service) => _service = service;

    [HttpPost]
    public async Task<ActionResult<LegacyImportSummary>> Import(CancellationToken cancellationToken)
    {
        var result = await _service.ImportAsync(cancellationToken);
        return result.Succeeded ? Ok(result) : Conflict(result);
    }
}
