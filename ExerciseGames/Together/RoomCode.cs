namespace ExerciseGames.Together
{
    public sealed class RoomCode
    {
        // Same alphabet the browser uses to host a game: no I, O, 0, or 1.
        public const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        private RoomCode(string value)
        {
            Value = value;
        }

        public string Value { get; }

        public static bool TryParse(string text, out RoomCode code)
        {
            code = null;
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            var trimmed = text.Trim().ToUpperInvariant();
            if (trimmed.Length != 4)
            {
                return false;
            }

            foreach (var character in trimmed)
            {
                if (Alphabet.IndexOf(character) < 0)
                {
                    return false;
                }
            }

            code = new RoomCode(trimmed);
            return true;
        }
    }
}
