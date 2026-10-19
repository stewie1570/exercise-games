using System.Threading.Tasks;
using ExerciseGames.Together;
using Microsoft.AspNetCore.SignalR;

namespace ExerciseGames.Hubs
{
    public sealed class SignalRPilotGreeting : IPilotGreeting
    {
        private readonly IHubContext<GameHub> _hub;

        public SignalRPilotGreeting(IHubContext<GameHub> hub)
        {
            _hub = hub;
        }

        public Task Announce(string pilotId)
        {
            return _hub.Clients.Client(pilotId).SendAsync("hello", new
            {
                connectionId = pilotId
            });
        }
    }
}
