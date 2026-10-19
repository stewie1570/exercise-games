using System;
using ExerciseGames.Together;
using Xunit;

namespace ExerciseGames.Tests.Together
{
    public class ServerClockTests
    {
        [Fact]
        public void The_system_clock_is_utc_unix_time()
        {
            var before = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var time = new SystemServerClock().UtcUnixMilliseconds();
            var after = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            Assert.InRange(time, before, after);
        }
    }
}
