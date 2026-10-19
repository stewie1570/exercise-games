using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ExerciseGames.Hubs;
using ExerciseGames.Together;
using Microsoft.AspNetCore.SignalR;
using Xunit;

namespace ExerciseGames.Tests.Hubs
{
    public class SignalRFlightRoomTests
    {
        private readonly ChannelSubstitute _channel = new ChannelSubstitute();
        private readonly SignalRFlightRoom _room;

        public SignalRFlightRoomTests()
        {
            _room = new SignalRFlightRoom(_channel);
        }

        [Fact]
        public async Task Seating_puts_the_pilot_in_the_room_group()
        {
            Assert.True(RoomCode.TryParse("abcd", out var room));

            await _room.Seat("pilot-1", room);

            Assert.Equal(("pilot-1", "together-ABCD"), Assert.Single(_channel.Groups.Added));
        }

        [Fact]
        public async Task A_plane_goes_to_everyone_else_in_the_room()
        {
            Assert.True(RoomCode.TryParse("ABCD", out var room));
            var plane = new PlaneStateDto { X = 8, Moving = true };

            await _room.ShowPlane("pilot-1", room, plane);

            Assert.Equal("together-ABCD", _channel.Clients.GroupName);
            Assert.Equal(new[] { "pilot-1" }, _channel.Clients.Excluded);
            var sent = Assert.Single(_channel.Clients.Others.Sent);
            Assert.Equal("plane", sent.Method);
            var connectionId = Payload.Property(sent.Args[0], "connectionId");
            var state = Payload.Property(sent.Args[0], "state");
            Assert.Equal("pilot-1", connectionId);
            Assert.Same(plane, state);
        }

        [Fact]
        public async Task Pins_go_to_everyone_else_in_the_room()
        {
            Assert.True(RoomCode.TryParse("WXYZ", out var room));
            using var document = JsonDocument.Parse("{\"fallen\":[1]}");

            await _room.ShowPins("pilot-9", room, document.RootElement);

            Assert.Equal("together-WXYZ", _channel.Clients.GroupName);
            Assert.Equal(new[] { "pilot-9" }, _channel.Clients.Excluded);
            var sent = Assert.Single(_channel.Clients.Others.Sent);
            Assert.Equal("pinState", sent.Method);
            var pins = Assert.IsType<JsonElement>(sent.Args[0]);
            Assert.Equal("{\"fallen\":[1]}", pins.GetRawText());
        }
    }

    public class SignalRPilotGreetingTests
    {
        [Fact]
        public async Task A_greeting_tells_that_pilot_their_connection_id()
        {
            var channel = new ChannelSubstitute();
            var greeting = new SignalRPilotGreeting(channel);

            await greeting.Announce("pilot-1");

            Assert.Equal("pilot-1", channel.Clients.GreetedId);
            var sent = Assert.Single(channel.Clients.Caller.Sent);
            Assert.Equal("hello", sent.Method);
            var connectionId = Payload.Property(sent.Args[0], "connectionId");
            Assert.Equal("pilot-1", connectionId);
        }
    }

    internal static class Payload
    {
        public static object Property(object? payload, string name)
        {
            Assert.NotNull(payload);
            var property = payload.GetType().GetProperty(name);
            Assert.NotNull(property);
            var value = property.GetValue(payload);
            Assert.NotNull(value);
            return value;
        }
    }

    internal sealed class ChannelSubstitute : IHubContext<GameHub>
    {
        public ChannelSubstitute()
        {
            Clients = new ClientsSubstitute();
            Groups = new GroupsSubstitute();
        }

        public ClientsSubstitute Clients { get; }
        IHubClients IHubContext<GameHub>.Clients => Clients;

        public GroupsSubstitute Groups { get; }
        IGroupManager IHubContext<GameHub>.Groups => Groups;
    }

    internal sealed class ClientsSubstitute : IHubClients
    {
        public ClientProxySubstitute Caller { get; } = new ClientProxySubstitute();
        public ClientProxySubstitute Others { get; } = new ClientProxySubstitute();
        public string? GreetedId { get; private set; }
        public string? GroupName { get; private set; }
        public IReadOnlyList<string> Excluded { get; private set; } = System.Array.Empty<string>();

        public IClientProxy All => throw new System.NotSupportedException();

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new System.NotSupportedException();

        public IClientProxy Client(string connectionId)
        {
            GreetedId = connectionId;
            return Caller;
        }

        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new System.NotSupportedException();

        public IClientProxy Group(string groupName) => throw new System.NotSupportedException();

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds)
        {
            GroupName = groupName;
            Excluded = excludedConnectionIds;
            return Others;
        }

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new System.NotSupportedException();

        public IClientProxy User(string userId) => throw new System.NotSupportedException();

        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new System.NotSupportedException();
    }

    internal sealed class GroupsSubstitute : IGroupManager
    {
        public List<(string ConnectionId, string Group)> Added { get; } = new List<(string, string)>();

        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            Added.Add((connectionId, groupName));
            return Task.CompletedTask;
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    internal sealed class ClientProxySubstitute : IClientProxy
    {
        public List<(string Method, object?[] Args)> Sent { get; } = new List<(string, object?[])>();

        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken)
        {
            Sent.Add((method, args));
            return Task.CompletedTask;
        }
    }
}
