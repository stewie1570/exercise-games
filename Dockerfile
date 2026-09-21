# Build image
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build-env
    ARG RELEASE_VERSION=1.0.0.0
    RUN echo "Version: ${RELEASE_VERSION}"
    WORKDIR /app

    RUN set -uex; \
        apt-get update; \
        apt-get install -y ca-certificates curl gnupg; \
        mkdir -p /etc/apt/keyrings; \
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg; \
        NODE_MAJOR=20; \
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list; \
        apt-get update; \
        apt-get install nodejs -y;

    RUN npm install -g yarn
    COPY . ./
    RUN dotnet restore
    WORKDIR /app/ExerciseGames
    RUN dotnet publish -c Release -o /app/out /property:Version=$RELEASE_VERSION

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0
    WORKDIR /app
    COPY --from=build-env /app/out .
    EXPOSE 80
    ENTRYPOINT ["dotnet", "ExerciseGames.dll"]
