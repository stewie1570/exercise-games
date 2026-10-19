using System.Collections.Generic;
using System.Text.Json;
using ExerciseGames.Controllers.Api;
using ExerciseGames.Features;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ExerciseGames.Tests.Features
{
    public class EnvironmentArrowControlsTests
    {
        [Theory]
        [InlineData("true", null, true)]
        [InlineData("TRUE", null, true)]
        [InlineData("1", null, true)]
        [InlineData("false", null, false)]
        [InlineData("yes", null, false)]
        [InlineData(null, "true", true)]
        [InlineData("no", "1", true)]
        [InlineData(null, null, false)]
        [InlineData("", "", false)]
        public void Arrow_controls_are_on_when_either_flag_says_so(string? vite, string? plain, bool enabled)
        {
            var values = new Dictionary<string, string>();
            if (vite != null)
            {
                values["VITE_ARROW_CONTROLS"] = vite;
            }
            if (plain != null)
            {
                values["ARROW_CONTROLS"] = plain;
            }

            var controls = new EnvironmentArrowControls(name => values.TryGetValue(name, out var value) ? value : null);

            Assert.Equal(enabled, controls.Enabled);
        }
    }

    public class FeaturesControllerTests
    {
        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void The_features_response_reports_the_arrow_control_policy(bool enabled)
        {
            var controller = new FeaturesController(new ArrowControlsSubstitute(enabled));

            var result = Assert.IsType<OkObjectResult>(controller.Get());
            var json = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            Assert.Contains("\"arrowControls\":" + (enabled ? "true" : "false"), json);
        }

        private sealed class ArrowControlsSubstitute : IArrowControls
        {
            public ArrowControlsSubstitute(bool enabled)
            {
                Enabled = enabled;
            }

            public bool Enabled { get; }
        }
    }
}
