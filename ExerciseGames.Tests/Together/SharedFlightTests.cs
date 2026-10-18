using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using ExerciseGames.Together;
using Microsoft.Extensions.Logging;
using Xunit;

namespace ExerciseGames.Tests.Together
{
    public class SharedFlightTests
    {
        private readonly RoomSubstitute _room = new RoomSubstitute();
        private readonly GreetingSubstitute _greeting = new GreetingSubstitute();
        private readonly ClockSubstitute _clock = new ClockSubstitute { Time = 1_700_000_000_000 };
        private readonly LogSubstitute _log = new LogSubstitute();
        private readonly SharedFlight _flight;

        public SharedFlightTests()
        {
            _flight = new SharedFlight(_room, _greeting, _clock, _log);
        }

        [Fact]
        public void Greeting_names_the_pilot_and_announces_that_id()
        {
            var id = _flight.Greet("pilot-1");

            Assert.Equal("pilot-1", id);
            Assert.Equal(new[] { "pilot-1" }, _greeting.Announced);
            Assert.Empty(_room.Seated);
        }

        [Fact]
        public void The_clock_is_the_server_clock()
        {
            Assert.Equal(1_700_000_000_000, _flight.ReadClock());
        }

        [Fact]
        public async Task Joining_seats_the_pilot_in_the_normalized_room()
        {
            var joined = await _flight.Join("pilot-1", " ab2d ");

            Assert.Equal("AB2D", joined);
            Assert.Equal(new[] { ("pilot-1", "AB2D") }, _room.Seated);
            Assert.Contains(_log.Messages, message => message.Contains("pilot-1") && message.Contains("AB2D"));
        }

        [Fact]
        public async Task A_code_that_could_not_be_hosted_does_not_seat_anyone()
        {
            var joined = await _flight.Join("pilot-1", "nope");

            Assert.Null(joined);
            Assert.Empty(_room.Seated);
            Assert.Empty(_log.Messages);
        }

        [Fact]
        public async Task A_plane_is_shown_to_the_rest_of_that_room()
        {
            var plane = new PlaneStateDto { X = 12, Moving = true };

            await _flight.SharePlane("pilot-1", "abcd", plane);

            Assert.Equal(new[] { ("pilot-1", "ABCD") }, _room.Planes);
            Assert.Same(plane, _room.ShownPlane);
        }

        [Fact]
        public async Task A_plane_for_a_bad_room_is_not_shown()
        {
            await _flight.SharePlane("pilot-1", "ABC1", new PlaneStateDto());

            Assert.Empty(_room.Planes);
        }

        [Fact]
        public async Task Pins_are_shown_to_the_rest_of_that_room()
        {
            using var document = JsonDocument.Parse("{\"fallen\":[1,2]}");

            await _flight.SharePins("pilot-1", "WXYZ", document.RootElement);

            Assert.Equal(new[] { ("pilot-1", "WXYZ") }, _room.PinRooms);
            Assert.Equal("{\"fallen\":[1,2]}", _room.Pins);
        }

        [Fact]
        public async Task Pins_for_a_bad_room_are_not_shown()
        {
            using var document = JsonDocument.Parse("{}");

            await _flight.SharePins("pilot-1", "****", document.RootElement);

            Assert.Empty(_room.PinRooms);
        }

        [Fact]
        public void Leaving_is_only_a_note_that_the_pilot_dropped()
        {
            _flight.NoteLeft("pilot-1");

            Assert.Contains(_log.Messages, message => message.Contains("pilot-1") && message.Contains("disconnect"));
            Assert.Empty(_room.Seated);
            Assert.Empty(_room.Planes);
        }

        private sealed class RoomSubstitute : IFlightRoom
        {
            public List<(string PilotId, string Room)> Seated { get; } = new List<(string, string)>();
            public List<(string PilotId, string Room)> Planes { get; } = new List<(string, string)>();
            public List<(string PilotId, string Room)> PinRooms { get; } = new List<(string, string)>();
            public PlaneStateDto? ShownPlane { get; private set; }
            public string? Pins { get; private set; }

            public Task Seat(string pilotId, RoomCode room)
            {
                Seated.Add((pilotId, room.Value));
                return Task.CompletedTask;
            }

            public Task ShowPlane(string pilotId, RoomCode room, PlaneStateDto plane)
            {
                Planes.Add((pilotId, room.Value));
                ShownPlane = plane;
                return Task.CompletedTask;
            }

            public Task ShowPins(string pilotId, RoomCode room, JsonElement pins)
            {
                PinRooms.Add((pilotId, room.Value));
                Pins = pins.GetRawText();
                return Task.CompletedTask;
            }
        }

        private sealed class GreetingSubstitute : IPilotGreeting
        {
            public List<string> Announced { get; } = new List<string>();

            public Task Announce(string pilotId)
            {
                Announced.Add(pilotId);
                return Task.CompletedTask;
            }
        }

        private sealed class ClockSubstitute : IServerClock
        {
            public long Time { get; set; }

            public long UtcUnixMilliseconds()
            {
                return Time;
            }
        }

        private sealed class LogSubstitute : ILogger<SharedFlight>
        {
            public List<string> Messages { get; } = new List<string>();

            public IDisposable BeginScope<TState>(TState state) where TState : notnull
            {
                return new Scope();
            }

            public bool IsEnabled(LogLevel logLevel)
            {
                return true;
            }

            public void Log<TState>(
                LogLevel logLevel,
                EventId eventId,
                TState state,
                Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                Messages.Add(formatter(state, exception));
            }

            private sealed class Scope : IDisposable
            {
                public void Dispose()
                {
                }
            }
        }
    }
}
