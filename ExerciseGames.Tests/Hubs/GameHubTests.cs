using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ExerciseGames.Hubs;
using ExerciseGames.Together;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Xunit;

namespace ExerciseGames.Tests.Hubs
{
    public class GameHubTests
    {
        private readonly FlightSubstitute _flight = new FlightSubstitute();
        private readonly GameHub _hub;

        public GameHubTests()
        {
            _hub = new GameHub(_flight)
            {
                Context = new Caller("pilot-1")
            };
        }

        [Fact]
        public async Task Hello_greets_this_connection()
        {
            var id = await _hub.Hello();

            Assert.Equal("pilot-1", id);
            Assert.Equal(new[] { "pilot-1" }, _flight.Greeted);
        }

        [Fact]
        public async Task Clock_reads_the_shared_flight_clock()
        {
            _flight.Time = 42;

            Assert.Equal(42, await _hub.Clock());
        }

        [Fact]
        public async Task Join_seats_this_connection()
        {
            var joined = await _hub.JoinRoom("abcd");

            Assert.Equal("ABCD", joined);
            Assert.Equal(new[] { ("pilot-1", "abcd") }, _flight.Joined);
        }

        [Fact]
        public async Task Plane_shares_this_connection_state()
        {
            var plane = new PlaneStateDto { Z = 4 };

            await _hub.Plane("abcd", plane);

            Assert.Equal("pilot-1", _flight.PlanePilot);
            Assert.Equal("abcd", _flight.PlaneCode);
            Assert.Same(plane, _flight.Plane);
        }

        [Fact]
        public async Task Pins_share_this_connection_state()
        {
            using var document = JsonDocument.Parse("{\"fallen\":[3]}");

            await _hub.PinState("abcd", document.RootElement);

            Assert.Equal("pilot-1", _flight.PinPilot);
            Assert.Equal("abcd", _flight.PinCode);
            Assert.Equal("{\"fallen\":[3]}", _flight.Pins);
        }

        [Fact]
        public async Task Disconnect_notes_that_this_connection_left()
        {
            await _hub.OnDisconnectedAsync(null);

            Assert.Equal(new[] { "pilot-1" }, _flight.Left);
        }

        private sealed class Caller : HubCallerContext
        {
            public Caller(string connectionId)
            {
                ConnectionId = connectionId;
            }

            public override string ConnectionId { get; }
            public override string? UserIdentifier => null;
            public override ClaimsPrincipal? User => new ClaimsPrincipal();
            public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
            public override IFeatureCollection Features { get; } = new FeatureCollection();
            public override CancellationToken ConnectionAborted => CancellationToken.None;

            public override void Abort()
            {
            }
        }

        private sealed class FlightSubstitute : ISharedFlight
        {
            public List<string> Greeted { get; } = new List<string>();
            public List<(string PilotId, string Code)> Joined { get; } = new List<(string, string)>();
            public List<string> Left { get; } = new List<string>();
            public long Time { get; set; }
            public string? PlanePilot { get; private set; }
            public string? PlaneCode { get; private set; }
            public PlaneStateDto? Plane { get; private set; }
            public string? PinPilot { get; private set; }
            public string? PinCode { get; private set; }
            public string? Pins { get; private set; }

            public string Greet(string pilotId)
            {
                Greeted.Add(pilotId);
                return pilotId;
            }

            public long ReadClock()
            {
                return Time;
            }

            public Task<string> Join(string pilotId, string code)
            {
                Joined.Add((pilotId, code));
                return Task.FromResult(code.ToUpperInvariant());
            }

            public Task SharePlane(string pilotId, string code, PlaneStateDto plane)
            {
                PlanePilot = pilotId;
                PlaneCode = code;
                Plane = plane;
                return Task.CompletedTask;
            }

            public Task SharePins(string pilotId, string code, JsonElement pins)
            {
                PinPilot = pilotId;
                PinCode = code;
                Pins = pins.GetRawText();
                return Task.CompletedTask;
            }

            public void NoteLeft(string pilotId)
            {
                Left.Add(pilotId);
            }
        }
    }
}
