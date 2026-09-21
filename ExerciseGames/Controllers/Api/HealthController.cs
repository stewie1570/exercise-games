using Microsoft.AspNetCore.Mvc;

namespace ExerciseGames.Controllers.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { status = "ok" });
        }
    }
}
