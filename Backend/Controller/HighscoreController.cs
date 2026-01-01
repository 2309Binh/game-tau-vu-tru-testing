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

        // GET: api/highscore/top/alltime
        [HttpGet("top/alltime")]
        public async Task<IActionResult> GetTopAlltime()
        {
            var scores = await _context.Highscores
                .OrderByDescending(h => h.Score)
                .Take(5)
                .Select(h => new
                {
                    h.PlayerName,
                    h.Score,
                    h.CreatedAt
                })
                .ToListAsync();

            return Ok(scores);
        }

         // GET: api/highscore/top/today
        [HttpGet("top/today")]
        public async Task<IActionResult> GetTopToday()
        {
            var today = DateTime.UtcNow.Date;

            var scores = await _context.Highscores
                .Where(h => h.CreatedAt >= today)
                .OrderByDescending(h => h.Score)
                .Take(5)
                .Select(h => new
                {
                    h.PlayerName,
                    h.Score,
                    h.CreatedAt
                })
                .ToListAsync();

            return Ok(scores);
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
