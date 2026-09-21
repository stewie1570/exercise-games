# Exercise Games

A React SPA with a .NET Web API / SignalR backend, set up like the Tetris repo. Games will be controlled with a camera and on-device pose tracking.

## Run

```terminal
dotnet run --project ExerciseGames/ExerciseGames.csproj
```

Then open [https://localhost:5001](https://localhost:5001). Allow camera access on the diagnostics page so the stick-figure overlay can trace your head and arms.

Frontend unit tests:

```terminal
cd ExerciseGames/ClientApp
yarn test
```

## Docker

```terminal
docker build -t exercise-games .
```
