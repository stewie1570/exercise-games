using System.Text.Json;
using ExerciseGames.Controllers.Api;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ExerciseGames.Tests.Controllers
{
    public class HealthControllerTests
    {
        [Fact]
        public void Health_is_ok()
        {
            var result = Assert.IsType<OkObjectResult>(new HealthController().Get());
            var json = JsonSerializer.Serialize(result.Value);

            Assert.Equal("{\"status\":\"ok\"}", json);
        }
    }
}
