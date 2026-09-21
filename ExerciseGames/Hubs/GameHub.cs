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

    public class GameHub : Hub
    {
        public Task Hello()
        {
            return Clients.Caller.SendAsync("hello", new { connectionId = Context.ConnectionId });
        }

        public Task Pose(PoseSnapshot pose)
        {
            return Clients.Others.SendAsync("pose", new
            {
                connectionId = Context.ConnectionId,
                pose
            });
        }
    }
}
