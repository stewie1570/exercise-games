using System;

namespace ExerciseGames.Features
{
    public interface IArrowControls
    {
        bool Enabled { get; }
    }

    public sealed class EnvironmentArrowControls : IArrowControls
    {
        private readonly Func<string, string> _read;

        public EnvironmentArrowControls()
            : this(Environment.GetEnvironmentVariable)
        {
        }

        internal EnvironmentArrowControls(Func<string, string> read)
        {
            _read = read;
        }

        public bool Enabled => On("VITE_ARROW_CONTROLS") || On("ARROW_CONTROLS");

        private bool On(string name)
        {
            var value = _read(name);
            return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) || value == "1";
        }
    }
}
