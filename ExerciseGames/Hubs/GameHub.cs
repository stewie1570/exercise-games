using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace ExerciseGames.Hubs
{
    public class PlaneStateDto
    {
        public double T { get; set; }
        public double X { get; set; }
        public double Z { get; set; }
        public double Altitude { get; set; }
        public double Heading { get; set; }
        public double Throttle { get; set; }
        public double ClimbRate { get; set; }
        public double ClimbCommand { get; set; }
        public double Speed { get; set; }
        public double Turn { get; set; }
        public bool Moving { get; set; }
    }

    public class GameHub : Hub
    {
        private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        public Task<string> Hello()
        {
            var connectionId = Context.ConnectionId;
            _ = Clients.Caller.SendAsync("hello", new { connectionId });
            return Task.FromResult(connectionId);
        }

        public Task<long> Clock()
        {
            return Task.FromResult(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }

        public async Task<string> JoinRoom(string code)
        {
            code = NormalizeCode(code);
            if (code == null)
            {
                return null;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(code));
            Console.WriteLine($"Multiplayer connect: {Context.ConnectionId} joined room {code}");
            return code;
        }

        public Task Plane(string code, PlaneStateDto state)
        {
            code = NormalizeCode(code);
            if (code == null)
            {
                return Task.CompletedTask;
            }

            return Clients.OthersInGroup(GroupName(code)).SendAsync("plane", new
            {
                connectionId = Context.ConnectionId,
                state
            });
        }

        public Task PinState(string code, JsonElement state)
        {
            code = NormalizeCode(code);
            if (code == null)
            {
                return Task.CompletedTask;
            }

            return Clients.OthersInGroup(GroupName(code)).SendAsync("pinState", state);
        }

        public override Task OnDisconnectedAsync(Exception exception)
        {
            Console.WriteLine($"Multiplayer disconnect: {Context.ConnectionId}");
            return base.OnDisconnectedAsync(exception);
        }

        private static string GroupName(string code) => $"together-{code}";

        private static string NormalizeCode(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return null;
            }

            var trimmed = code.Trim().ToUpperInvariant();
            if (trimmed.Length != 4)
            {
                return null;
            }

            foreach (var character in trimmed)
            {
                if (Alphabet.IndexOf(character) < 0)
                {
                    return null;
                }
            }

            return trimmed;
        }
    }
}
