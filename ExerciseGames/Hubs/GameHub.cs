using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace ExerciseGames.Hubs
{
    public class PoseSnapshot
    {
        public HeadPose Head { get; set; }
        public ArmPose LeftArm { get; set; }
        public ArmPose RightArm { get; set; }
    }

    public class HeadPose
    {
        public double? TiltDeg { get; set; }
        public double? TurnDeg { get; set; }
        public double? PitchDeg { get; set; }
    }

    public class ArmPose
    {
        public double? UpperArmDeg { get; set; }
        public double? ElbowDeg { get; set; }
        public double? ForearmDeg { get; set; }
    }

    public class PlaneStateDto
    {
        public long T { get; set; }
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

    public class PinHitDto
    {
        public string HitId { get; set; }
        public long T { get; set; }
        public double Dt { get; set; }
        public PlaneStateDto Plane { get; set; }
    }

    public class RosterDto
    {
        public string Code { get; set; }
        public string HostConnectionId { get; set; }
        public string[] Players { get; set; }
    }

    public class RoomSessionDto : RosterDto
    {
        public string ConnectionId { get; set; }
    }

    public class GameHub : Hub
    {
        private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        private static readonly ConcurrentDictionary<string, Room> RoomsByCode = new();
        private static readonly ConcurrentDictionary<string, string> CodeByConnection = new();

        public Task Hello()
        {
            return Clients.Caller.SendAsync("hello", new { connectionId = Context.ConnectionId });
        }

        public Task<long> Clock()
        {
            return Task.FromResult(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }

        public Task Pose(PoseSnapshot pose)
        {
            return Clients.Others.SendAsync("pose", new
            {
                connectionId = Context.ConnectionId,
                pose
            });
        }

        public async Task<RoomSessionDto> HostRoom()
        {
            await LeaveRoom();
            Room room = null;
            for (var attempt = 0; attempt < 8 && room == null; attempt += 1)
            {
                var code = NewCode();
                var created = new Room(code, Context.ConnectionId);
                if (RoomsByCode.TryAdd(code, created))
                {
                    room = created;
                }
            }

            if (room == null)
            {
                return null;
            }

            CodeByConnection[Context.ConnectionId] = room.Code;
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(room.Code));
            var roster = Roster(room);
            await Clients.Group(GroupName(room.Code)).SendAsync("roster", roster);
            return Session(roster);
        }

        public async Task<RoomSessionDto> JoinRoom(string code)
        {
            code = NormalizeCode(code);
            if (code == null || !RoomsByCode.TryGetValue(code, out var room))
            {
                return null;
            }

            await LeaveRoom();
            if (!RoomsByCode.TryGetValue(code, out room))
            {
                return null;
            }

            lock (room.Gate)
            {
                if (!room.Players.Contains(Context.ConnectionId))
                {
                    room.Players.Add(Context.ConnectionId);
                }
            }

            CodeByConnection[Context.ConnectionId] = room.Code;
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(room.Code));
            var roster = Roster(room);
            await Clients.Group(GroupName(room.Code)).SendAsync("roster", roster);
            return Session(roster);
        }

        public async Task LeaveRoom()
        {
            if (!CodeByConnection.TryRemove(Context.ConnectionId, out var code))
            {
                return;
            }

            if (!RoomsByCode.TryGetValue(code, out var room))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(code));
                return;
            }

            List<string> dropped = null;
            var hostLeft = false;
            lock (room.Gate)
            {
                room.Players.Remove(Context.ConnectionId);
                hostLeft = room.HostConnectionId == Context.ConnectionId;
                if (hostLeft)
                {
                    dropped = room.Players.ToList();
                    room.Players.Clear();
                }
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(code));
            if (hostLeft || room.Players.Count == 0)
            {
                RoomsByCode.TryRemove(code, out _);
                if (dropped != null)
                {
                    foreach (var player in dropped)
                    {
                        CodeByConnection.TryRemove(player, out _);
                        await Groups.RemoveFromGroupAsync(player, GroupName(code));
                    }
                }

                await Clients.Group(GroupName(code)).SendAsync("roomClosed");
                return;
            }

            await Clients.Group(GroupName(code)).SendAsync("roster", Roster(room));
        }

        public Task Plane(PlaneStateDto state)
        {
            if (!TryGetRoom(out var room))
            {
                return Task.CompletedTask;
            }

            return Clients.OthersInGroup(GroupName(room.Code)).SendAsync("plane", new
            {
                connectionId = Context.ConnectionId,
                state
            });
        }

        public Task PinHit(PinHitDto hit)
        {
            if (!TryGetRoom(out var room) || room.HostConnectionId == Context.ConnectionId)
            {
                return Task.CompletedTask;
            }

            return Clients.Client(room.HostConnectionId).SendAsync("pinHit", new
            {
                connectionId = Context.ConnectionId,
                hit
            });
        }

        public Task PinState(JsonElement state)
        {
            if (!TryGetRoom(out var room) || room.HostConnectionId != Context.ConnectionId)
            {
                return Task.CompletedTask;
            }

            return Clients.OthersInGroup(GroupName(room.Code)).SendAsync("pinState", state);
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            await LeaveRoom();
            await base.OnDisconnectedAsync(exception);
        }

        private RoomSessionDto Session(RosterDto roster)
        {
            return new RoomSessionDto
            {
                Code = roster.Code,
                HostConnectionId = roster.HostConnectionId,
                Players = roster.Players,
                ConnectionId = Context.ConnectionId,
            };
        }

        private bool TryGetRoom(out Room room)
        {
            room = null;
            return CodeByConnection.TryGetValue(Context.ConnectionId, out var code)
                && RoomsByCode.TryGetValue(code, out room);
        }

        private static RosterDto Roster(Room room)
        {
            lock (room.Gate)
            {
                return new RosterDto
                {
                    Code = room.Code,
                    HostConnectionId = room.HostConnectionId,
                    Players = room.Players.ToArray(),
                };
            }
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

        private static string NewCode()
        {
            Span<char> chars = stackalloc char[4];
            for (var i = 0; i < chars.Length; i += 1)
            {
                chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            }

            return new string(chars);
        }

        private sealed class Room
        {
            public Room(string code, string hostConnectionId)
            {
                Code = code;
                HostConnectionId = hostConnectionId;
                Players.Add(hostConnectionId);
            }

            public string Code { get; }
            public string HostConnectionId { get; }
            public List<string> Players { get; } = new();
            public object Gate { get; } = new();
        }
    }
}
