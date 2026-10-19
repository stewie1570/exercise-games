using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ExerciseGames.Together
{
    public interface ISharedFlight
    {
        string Greet(string pilotId);

        long ReadClock();

        Task<string> Join(string pilotId, string code);

        Task SharePlane(string pilotId, string code, PlaneStateDto plane);

        Task SharePins(string pilotId, string code, JsonElement pins);

        void NoteLeft(string pilotId);
    }

    public sealed class SharedFlight : ISharedFlight
    {
        private readonly IFlightRoom _room;
        private readonly IPilotGreeting _greeting;
        private readonly IServerClock _clock;
        private readonly ILogger<SharedFlight> _log;

        public SharedFlight(
            IFlightRoom room,
            IPilotGreeting greeting,
            IServerClock clock,
            ILogger<SharedFlight> log)
        {
            _room = room;
            _greeting = greeting;
            _clock = clock;
            _log = log;
        }

        public string Greet(string pilotId)
        {
            // The hub invocation also returns the id, so the push must not delay the greeting.
            _ = _greeting.Announce(pilotId);
            return pilotId;
        }

        public long ReadClock()
        {
            return _clock.UtcUnixMilliseconds();
        }

        public async Task<string> Join(string pilotId, string code)
        {
            if (!RoomCode.TryParse(code, out var room))
            {
                return null;
            }

            await _room.Seat(pilotId, room);
            _log.LogInformation("Multiplayer connect: {PilotId} joined room {Code}", pilotId, room.Value);
            return room.Value;
        }

        public Task SharePlane(string pilotId, string code, PlaneStateDto plane)
        {
            if (!RoomCode.TryParse(code, out var room))
            {
                return Task.CompletedTask;
            }

            return _room.ShowPlane(pilotId, room, plane);
        }

        public Task SharePins(string pilotId, string code, JsonElement pins)
        {
            if (!RoomCode.TryParse(code, out var room))
            {
                return Task.CompletedTask;
            }

            return _room.ShowPins(pilotId, room, pins);
        }

        public void NoteLeft(string pilotId)
        {
            _log.LogInformation("Multiplayer disconnect: {PilotId}", pilotId);
        }
    }
}
