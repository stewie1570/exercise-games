using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using ExerciseGames;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xunit;

namespace ExerciseGames.Tests.Hosting
{
    public class ExceptionHandlerTests
    {
        [Theory]
        [InlineData("Production", false)]
        [InlineData("Development", true)]
        public async Task An_error_is_json_and_hides_the_stack_outside_development(string environment, bool includeStack)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddMetrics();
            services.AddSingleton(new DiagnosticListener("ExerciseGames.Tests"));
            var provider = services.BuildServiceProvider();
            var app = new ApplicationBuilder(provider);
            app.UseCustomExceptionHandler(new HostEnvironment(environment), provider.GetRequiredService<ILoggerFactory>());
            app.Run(_ => throw new InvalidOperationException("boom"));
            var pipeline = app.Build();

            var context = new DefaultHttpContext();
            context.RequestServices = provider;
            context.Response.Body = new MemoryStream();

            await pipeline(context);

            context.Response.Body.Position = 0;
            using var document = JsonDocument.Parse(context.Response.Body);
            var body = document.RootElement;

            Assert.Equal("application/json", context.Response.ContentType);
            Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
            Assert.Equal(500, body.GetProperty("status").GetInt32());
            Assert.Equal("An error occurred.", body.GetProperty("title").GetString());
            var detail = body.GetProperty("detail").GetString();
            if (includeStack)
            {
                Assert.False(string.IsNullOrEmpty(detail));
            }
            else
            {
                Assert.Equal(string.Empty, detail);
            }
        }

        private sealed class HostEnvironment : IWebHostEnvironment
        {
            public HostEnvironment(string environmentName)
            {
                EnvironmentName = environmentName;
            }

            public string EnvironmentName { get; set; }
            public string ApplicationName { get; set; } = "ExerciseGames";
            public string ContentRootPath { get; set; } = "";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string WebRootPath { get; set; } = "";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        }
    }
}
