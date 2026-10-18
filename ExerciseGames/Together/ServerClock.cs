using System;

namespace ExerciseGames.Together
{
    public interface IServerClock
    {
        long UtcUnixMilliseconds();
    }

    public sealed class SystemServerClock : IServerClock
    {
        public long UtcUnixMilliseconds()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
