using ExerciseGames.Together;
using Xunit;

namespace ExerciseGames.Tests.Together
{
    public class RoomCodeTests
    {
        [Theory]
        [InlineData("ABCD")]
        [InlineData("abcd")]
        [InlineData("  ab2d ")]
        [InlineData("A2B3")]
        public void Accepts_a_four_character_code_from_the_shared_alphabet(string text)
        {
            var parsed = RoomCode.TryParse(text, out var code);

            Assert.True(parsed);
            Assert.Equal(text.Trim().ToUpperInvariant(), code.Value);
            Assert.Equal(4, code.Value.Length);
            Assert.All(code.Value, character => Assert.Contains(character, RoomCode.Alphabet));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("ABC")]
        [InlineData("ABCDE")]
        [InlineData("ABCI")]
        [InlineData("abco")]
        [InlineData("ABC0")]
        [InlineData("ABC1")]
        [InlineData("AB-D")]
        public void Refuses_a_code_a_pilot_could_not_have_hosted(string? text)
        {
            Assert.False(RoomCode.TryParse(text, out _));
        }
    }
}
