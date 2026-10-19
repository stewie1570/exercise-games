using ExerciseGames.Features;
using Microsoft.AspNetCore.Mvc;

namespace ExerciseGames.Controllers.Api
{
    public class GameFeaturesResponse
    {
        public bool ArrowControls { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class FeaturesController : ControllerBase
    {
        private readonly IArrowControls _arrowControls;

        public FeaturesController(IArrowControls arrowControls)
        {
            _arrowControls = arrowControls;
        }

        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new GameFeaturesResponse
            {
                ArrowControls = _arrowControls.Enabled
            });
        }
    }
}
