using ExerciseGames;
using ExerciseGames.Features;
using ExerciseGames.Together;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ExerciseGames.Tests.Hosting
{
    public class StartupTests
    {
        [Fact]
        public void The_host_supplies_the_shared_flight_and_arrow_controls()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            new Startup(new ConfigurationBuilder().Build()).ConfigureServices(services);
            using var provider = services.BuildServiceProvider();

            Assert.IsType<SharedFlight>(provider.GetRequiredService<ISharedFlight>());
            Assert.IsType<EnvironmentArrowControls>(provider.GetRequiredService<IArrowControls>());
            Assert.IsType<SystemServerClock>(provider.GetRequiredService<IServerClock>());
        }
    }
}
