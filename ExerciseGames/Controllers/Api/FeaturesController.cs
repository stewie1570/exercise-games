using System;
using Microsoft.AspNetCore.Mvc;

namespace ExerciseGames.Controllers.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeaturesController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new
            {
                arrowControls = IsEnabled("VITE_ARROW_CONTROLS") || IsEnabled("ARROW_CONTROLS"),
            });
        }

        private static bool IsEnabled(string name)
        {
            var value = Environment.GetEnvironmentVariable(name);
            return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
                || value == "1";
        }
    }
}
