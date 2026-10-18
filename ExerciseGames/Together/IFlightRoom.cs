using System.Text.Json;
using System.Threading.Tasks;

namespace ExerciseGames.Together
{
    // The other pilots in a room. The pilot id is the sender, and that sender is not told again.
    public interface IFlightRoom
    {
        Task Seat(string pilotId, RoomCode room);

        Task ShowPlane(string pilotId, RoomCode room, PlaneStateDto plane);

        Task ShowPins(string pilotId, RoomCode room, JsonElement pins);
    }
}
