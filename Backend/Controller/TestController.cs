using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace backend.Controller;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly string _configPath = Path.Combine("Properties", "game-config.json");

    // GET /api/config
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        if (!System.IO.File.Exists(_configPath))
            return NotFound("Config-Datei nicht gefunden");
            Console.WriteLine("_configPath");

        var json = await System.IO.File.ReadAllTextAsync(_configPath);
        var config = JsonSerializer.Deserialize<object>(json);
        Console.WriteLine("config");
        return Ok(config);
    }

    // POST /api/config
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] object newConfig)
    {
        try
        {
            var json = JsonSerializer.Serialize(newConfig, new JsonSerializerOptions { WriteIndented = true });
            await System.IO.File.WriteAllTextAsync(_configPath, json);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }
}
