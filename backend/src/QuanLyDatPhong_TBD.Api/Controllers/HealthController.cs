using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet("ready")]
    public async Task<IActionResult> Ready([FromServices] IConfiguration configuration, CancellationToken cancellationToken)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(3));
        var settings = new NpgsqlConnectionStringBuilder(configuration.GetConnectionString("DefaultConnection")) {
            Timeout = 3, CommandTimeout = 3
        };
        await using var connection = new NpgsqlConnection(settings.ConnectionString);
        await connection.OpenAsync(deadline.Token);
        await using var command = new NpgsqlCommand("SELECT 1", connection);
        await command.ExecuteScalarAsync(deadline.Token);
        return Ok(new { status = "ready" });
    }
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { status = "ok", service = "Quan Ly Dat Phong TBD API" });
    }
}
