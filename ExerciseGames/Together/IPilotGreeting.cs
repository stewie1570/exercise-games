using System.Threading.Tasks;

namespace ExerciseGames.Together
{
    // Tells one pilot the connection id the rest of the room will see.
    public interface IPilotGreeting
    {
        Task Announce(string pilotId);
    }
}
