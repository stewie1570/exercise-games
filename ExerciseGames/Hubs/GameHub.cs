using System;
using System.Text.Json;
using System.Threading.Tasks;
using ExerciseGames.Together;
using Microsoft.AspNetCore.SignalR;

namespace ExerciseGames.Hubs
{
    public class GameHub : Hub
    {
        private readonly ISharedFlight _flight;

        public GameHub(ISharedFlight flight)
        {
            _flight = flight;
        }

        public Task<string> Hello()
        {
            return Task.FromResult(_flight.Greet(Context.ConnectionId));
        }

        public Task<long> Clock()
        {
            return Task.FromResult(_flight.ReadClock());
        }

        public Task<string> JoinRoom(string code)
        {
            return _flight.Join(Context.ConnectionId, code);
        }

        public Task Plane(string code, PlaneStateDto state)
        {
            return _flight.SharePlane(Context.ConnectionId, code, state);
        }

        public Task PinState(string code, JsonElement state)
        {
            return _flight.SharePins(Context.ConnectionId, code, state);
        }

        public override Task OnDisconnectedAsync(Exception exception)
        {
            _flight.NoteLeft(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }
    }
}
