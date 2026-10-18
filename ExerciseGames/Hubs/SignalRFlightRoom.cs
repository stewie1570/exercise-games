using System.Text.Json;
using System.Threading.Tasks;
using ExerciseGames.Together;
using Microsoft.AspNetCore.SignalR;

namespace ExerciseGames.Hubs
{
    public sealed class SignalRFlightRoom : IFlightRoom
    {
        private readonly IHubContext<GameHub> _hub;

        public SignalRFlightRoom(IHubContext<GameHub> hub)
        {
            _hub = hub;
        }

        public Task Seat(string pilotId, RoomCode room)
        {
            return _hub.Groups.AddToGroupAsync(pilotId, Group(room));
        }

        public Task ShowPlane(string pilotId, RoomCode room, PlaneStateDto plane)
        {
            return Others(pilotId, room).SendAsync("plane", new
            {
                connectionId = pilotId,
                state = plane
            });
        }

        public Task ShowPins(string pilotId, RoomCode room, JsonElement pins)
        {
            return Others(pilotId, room).SendAsync("pinState", pins);
        }

        private IClientProxy Others(string pilotId, RoomCode room)
        {
            return _hub.Clients.GroupExcept(Group(room), new[] { pilotId });
        }

        private static string Group(RoomCode room)
        {
            return "together-" + room.Value;
        }
    }
}
