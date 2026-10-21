using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using Scalar.AspNetCore;
using SistemaHB.Services;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services;
using System.Text;

namespace SistemaHBAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            builder.Services.AddControllers()
                .AddNewtonsoftJson(options =>
                    options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore);
            builder.Services.AddTransient<IEmailService, EmailService>();
            
            QuestPDF.Settings.License = LicenseType.Community;
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = "https://onrender.com",
                        ValidAudience = "SistemaHBAutenticacionApi",
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("TuClaveSecretaSuperSeguraDeAlMenos32Bytes!"))
                    };
                });

            // 2. Configurar los servicios de Autorización
            builder.Services.AddAuthorization();

            // Configurar OpenAPI para generación de documentos de endpoints
            builder.Services.AddOpenApi();

            // 3. Cadena de conexión corregida para Aiven con SSL Obligatorio
            // NOTA: Asegúrate de reemplazar 'REEMPLAZA_CON_TU_SUBDOMINIO' por el subdominio real que te da Aiven (ejemplo: mysql-mi-proyecto)
            var connectionString = "Server=mysql-1e7e449b-sistemahb.g.aivencloud.com;Port=13585;Database=sistemahb;Uid=avnadmin;Pwd=AVNS_RAotqvpMbH5nDsAc7GR;SslMode=Required;AllowPublicKeyRetrieval=True;";

            builder.Services.AddDbContext<SistemaHBContext>(options =>
            {
                options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 4, 0)), mySqlOptions =>
                {
                    // Añade resiliencia para mitigar fallos transitorios en nubes como Render
                    mySqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorNumbersToAdd: null
                    );
                });
            });

            // 4. Configurar CORS flexible (Soporta origen 'null', file:///, localhost y móviles)
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

            // 5. Configurar encabezados reenviados para compatibilidad nativa HTTP/HTTPS en Render
            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
            });
            builder.Services.AddHttpClient();
            var app = builder.Build();

            // 6. Habilitar middleware de encabezados reenviados en la primera línea
            app.UseForwardedHeaders();

            // 7. OpenAPI y documentación interactiva de Scalar habilitados globalmente
            app.MapOpenApi();
            app.MapScalarApiReference(options =>
            {
                options.WithOpenApiRoutePattern("/openapi/v1.json");
            });

            // 8. Middleware de CORS (Debe estar estrictamente ANTES de la autenticación)
            app.UseCors("PermitirTodo");

            // 9. Middlewares de seguridad indispensables
            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            app.Run();
        }
    }
}
