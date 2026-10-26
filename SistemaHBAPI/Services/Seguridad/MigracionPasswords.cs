using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SistemaHBAPI.Configuracion;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Seguridad
{
    /// <summary>
    /// Convierte a hash las contraseñas que todavía están en texto plano. Es idempotente: solo toca
    /// filas que no son hash, así que puede ejecutarse en cada arranque sin riesgo.
    /// </summary>
    public static class MigracionPasswords
    {
        public static async Task EjecutarAsync(IServiceProvider servicios)
        {
            using var scope = servicios.CreateScope();
            var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("MigracionPasswords");

            if (!scope.ServiceProvider.GetRequiredService<IOptions<SeguridadOptions>>().Value.MigrarPasswordsAlIniciar)
            {
                return;
            }

            try
            {
                var contexto = scope.ServiceProvider.GetRequiredService<SistemaHBContext>();
                var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();

                var pendientes = (await contexto.CorreosElectronicos
                        .Where(c => c.Contraseña != null && c.Contraseña != "")
                        .ToListAsync())
                    .Where(c => !passwords.EsHash(c.Contraseña))
                    .ToList();

                if (pendientes.Count == 0) return;

                foreach (var correo in pendientes)
                {
                    correo.Contraseña = passwords.Hash(correo.Contraseña!);
                }

                await contexto.SaveChangesAsync();
                logger.LogInformation("Contraseñas migradas a hash: {Cantidad}", pendientes.Count);
            }
            catch (Exception ex)
            {
                // No se bloquea el arranque: el login sigue aceptando texto plano y lo convierte al ingresar.
                logger.LogError(ex, "No se pudo migrar las contraseñas a hash al iniciar.");
            }
        }
    }
}
