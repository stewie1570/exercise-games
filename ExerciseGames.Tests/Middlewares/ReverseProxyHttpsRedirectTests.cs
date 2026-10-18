using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Website.Middlewares;
using Xunit;

namespace ExerciseGames.Tests.Middlewares
{
    public class ReverseProxyHttpsRedirectTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("https")]
        public async Task Direct_and_https_requests_continue(string? forwardedProto)
        {
            var called = false;
            var middleware = new ReverseProxyHttpsRedirect(_ =>
            {
                called = true;
                return Task.CompletedTask;
            });
            var context = new DefaultHttpContext();
            if (forwardedProto != null)
            {
                context.Request.Headers["X-Forwarded-Proto"] = forwardedProto;
            }

            await middleware.Invoke(context);

            Assert.True(called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task An_http_forwarded_request_redirects_to_https()
        {
            var called = false;
            var middleware = new ReverseProxyHttpsRedirect(_ =>
            {
                called = true;
                return Task.CompletedTask;
            });
            var context = new DefaultHttpContext();
            context.Request.Headers["X-Forwarded-Proto"] = "http";
            context.Request.Host = new HostString("play.example");
            context.Request.Path = "/fly";
            context.Request.QueryString = new QueryString("?lane=1");

            await middleware.Invoke(context);

            Assert.False(called);
            Assert.Equal(StatusCodes.Status302Found, context.Response.StatusCode);
            Assert.Equal("https://play.example/fly?lane=1", context.Response.Headers.Location.ToString());
        }
    }
}
