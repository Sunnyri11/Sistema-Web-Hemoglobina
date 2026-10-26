using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SistemaHBAPI.Configuracion;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.Autenticacion;
using SistemaHBAPI.Services.Correo;
using SistemaHBAPI.Services.Datos;
using SistemaHBAPI.Services.IA;
using SistemaHBAPI.Services.Seguridad;
using SistemaHBAPI.Services.Usuarios;
using System.Text;

namespace SistemaHBAPI.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public const string PoliticaCors = "PermitirTodo";

        /// <summary>Lee las secciones de appsettings.json (o variables de entorno en Render).</summary>
        public static IServiceCollection AddOpcionesSistema(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<JwtOptions>(config.GetSection(JwtOptions.Seccion));
            services.Configure<EmailOptions>(config.GetSection(EmailOptions.Seccion));
            services.Configure<WalleOptions>(config.GetSection(WalleOptions.Seccion));
            services.Configure<FrontendOptions>(config.GetSection(FrontendOptions.Seccion));
            services.Configure<SeguridadOptions>(config.GetSection(SeguridadOptions.Seccion));
            return services;
        }

        /// <summary>MySQL en Aiven (SSL obligatorio) con reintentos para los fallos transitorios típicos de la nube.</summary>
        public static IServiceCollection AddBaseDeDatos(this IServiceCollection services, IConfiguration config)
        {
            var cadena = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Falta ConnectionStrings:DefaultConnection (cadena de conexión de Aiven).");

            services.AddDbContext<SistemaHBContext>(options =>
                options.UseMySql(cadena, new MySqlServerVersion(new Version(8, 4, 0)), mysql =>
                    mysql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(30), errorNumbersToAdd: null)));

            return services;
        }

        /// <summary>Validación de los tokens JWT con los mismos datos con los que los emite JwtService.</summary>
        public static IServiceCollection AddAutenticacionJwt(this IServiceCollection services, IConfiguration config)
        {
            var jwt = config.GetSection(JwtOptions.Seccion).Get<JwtOptions>()
                ?? throw new InvalidOperationException("Falta la sección Jwt en la configuración.");

            if (string.IsNullOrWhiteSpace(jwt.Key) || Encoding.UTF8.GetByteCount(jwt.Key) < 32)
                throw new InvalidOperationException("Jwt:Key debe tener al menos 32 caracteres.");

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwt.Issuer,
                        ValidAudience = jwt.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key))
                    };
                });

            services.AddAuthorization();
            return services;
        }

        /// <summary>CORS abierto: acepta origen "null", file:///, localhost, GitHub Pages y móviles.</summary>
        public static IServiceCollection AddCorsSistema(this IServiceCollection services)
        {
            services.AddCors(options => options.AddPolicy(PoliticaCors, policy =>
                policy.SetIsOriginAllowed(_ => true)
                      .AllowAnyMethod()
                      .AllowAnyHeader()
                      .AllowCredentials()));
            return services;
        }

        /// <summary>Render termina el HTTPS en su proxy: hay que respetar X-Forwarded-For/Proto.</summary>
        public static IServiceCollection AddProxyDeRender(this IServiceCollection services)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
            });
            return services;
        }

        /// <summary>Todos los servicios de la aplicación (la lógica que antes vivía en los controladores).</summary>
        public static IServiceCollection AddServiciosSistema(this IServiceCollection services)
        {
            // Seguridad
            services.AddSingleton<IPasswordService, PasswordService>();
            services.AddSingleton<CryptoService>();
            services.AddScoped<IJwtService, JwtService>();

            // Cuentas
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IRegistroService, RegistroService>();
            services.AddScoped<IPerfilService, PerfilService>();
            services.AddScoped<IPacienteService, PacienteService>();
            services.AddScoped<IMedicoService, MedicoService>();
            services.AddScoped<IAdministradorService, AdministradorService>();

            // Datos clínicos
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<ICatalogoService, CatalogoService>();
            services.AddScoped<IRangoHemoglobinaService, RangoHemoglobinaService>();

            // Correo (Brevo)
            services.AddScoped<IReporteService, ReporteService>();
            services.AddScoped<IRecuperacionService, RecuperacionService>();
            services.AddScoped<INotificacionesEmailService, NotificacionesEmailService>();

            // Clientes HTTP externos
            services.AddHttpClient<IEmailService, EmailService>();
            services.AddHttpClient<IWalleService, WalleService>((sp, http) =>
            {
                http.Timeout = TimeSpan.FromSeconds(sp.GetRequiredService<IOptions<WalleOptions>>().Value.TimeoutSegundos);
            });

            return services;
        }
    }
}
