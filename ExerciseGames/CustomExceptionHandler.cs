using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ExerciseGames
{
    public static class CustomExceptionHandler
    {
        public static IApplicationBuilder UseCustomExceptionHandler(
            this IApplicationBuilder app,
            IWebHostEnvironment env,
            ILoggerFactory loggerFactory)
        {
            app.UseExceptionHandler(appError =>
            {
                appError.Run(async context =>
                {
                    var contextFeature = context.Features.Get<IExceptionHandlerFeature>();
                    await Respond(env, loggerFactory, context, contextFeature);
                });
            });

            return app;
        }

        private static async Task Respond(
            IWebHostEnvironment env,
            ILoggerFactory loggerFactory,
            HttpContext context,
            IExceptionHandlerFeature contextFeature)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            if (contextFeature == null)
            {
                return;
            }

            var logger = loggerFactory.CreateLogger("ExceptionHandler");
            logger.LogError(contextFeature.Error, "An error occurred.");

            var payload = new
            {
                status = (int)HttpStatusCode.InternalServerError,
                title = "An error occurred.",
                detail = env.IsDevelopment() ? contextFeature.Error.StackTrace : string.Empty
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));
        }
    }
}
