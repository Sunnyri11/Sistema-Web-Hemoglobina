using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using Scalar.AspNetCore;
using SistemaHB.Services;
using SistemaHBAPI.Extensions;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services;
using SistemaHBAPI.Services.Seguridad;
using System.Text;

namespace SistemaHBAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // 1. Agregar servicios esenciales al contenedor (Sin duplicados)
            builder.Services.AddControllers()
                .AddNewtonsoftJson(options =>
                    options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore);

            builder.Services.AddTransient<IEmailService, EmailService>();
            QuestPDF.Settings.License = LicenseType.Community;

            // 2. Configurar los servicios de Autorización y SignalR
            builder.Services.AddAuthorization();
            builder.Services.AddSignalR();

            // 3. Extensiones del sistema (Aquí adentro ya se registra .AddAutenticacionJwt de forma limpia)
            builder.Services
                .AddOpcionesSistema(builder.Configuration)
                .AddBaseDeDatos(builder.Configuration)
                .AddAutenticacionJwt(builder.Configuration)
                .AddCorsSistema()
                .AddProxyDeRender()
                .AddServiciosSistema();

            // Configurar OpenAPI para generación de documentos de endpoints
            builder.Services.AddOpenApi();

            // 4. Cadena de conexión corregida para Aiven con SSL Obligatorio
            var connectionString = "Server=mysql-1e7e449b-sistemahb.g.aivencloud.com;Port=13585;Database=sistemahb;Uid=avnadmin;Pwd=AVNS_RAotqvpMbH5nDsAc7GR;SslMode=Required;AllowPublicKeyRetrieval=True;";

            builder.Services.AddDbContext<SistemaHBContext>(options =>
            {
                options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 4, 0)), mySqlOptions =>
                {
                    mySqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null
                    );
                });
            });

            // 5. Configurar CORS flexible (Soporta origen 'null', file:///, localhost y móviles)
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("PermitirTodo", policy =>
                {
                    policy.SetIsOriginAllowed(_ => true)
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });
            });

            // 6. Configurar encabezados reenviados para compatibilidad nativa HTTP/HTTPS en Render
            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
            });
            builder.Services.AddHttpClient();

            var app = builder.Build();

            // 7. Habilitar middleware de encabezados reenviados en la primera línea
            app.UseForwardedHeaders();

            // 8. OpenAPI y documentación interactiva de Scalar habilitados globalmente
            app.MapOpenApi();
            app.MapScalarApiReference(options =>
            {
                options.WithOpenApiRoutePattern("/openapi/v1.json");
            });

            // 9. Middleware de CORS (Debe estar estrictamente ANTES de la autenticación)
            app.UseCors("PermitirTodo");

            // 10. Middlewares de seguridad indispensables
            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<BibliotecaSistemaHB.NotificacionesHub>("/notificacionesHub");
            app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(() => MigracionPasswords.EjecutarAsync(app.Services)));

            app.Run();
        }
    }
}
