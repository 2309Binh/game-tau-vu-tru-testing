using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controller
{
    [ApiController]
    [Route("api/[controller]")]
    public class HighscoreController : ControllerBase
    {
        private readonly GameDbContext _context;

        public HighscoreController(GameDbContext context)
        {
            _context = context;
        }

        // GET: api/highscore
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var highscores = await _context.Highscores
                .OrderByDescending(h => h.Score)
                .ToListAsync();

            return Ok(highscores);
        }

        // POST: api/highscore
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Highscore highscore)
        {
            _context.Highscores.Add(highscore);
            await _context.SaveChangesAsync();
            return Ok(highscore);
        }
    }
}
