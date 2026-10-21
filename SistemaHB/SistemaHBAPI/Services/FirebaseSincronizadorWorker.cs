using Firebase.Database;
using Firebase.Database.Query;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SistemaHBAPI.Models;
using BibliotecaSistemaHB;

namespace SistemaHBAPI.Services
{
    public class FirebaseSincronizadorWorker : BackgroundService
    {
        private readonly ILogger<FirebaseSincronizadorWorker> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly string _firebaseUrl;
        private FirebaseClient? _firebaseClient;
        private IDisposable? _firebaseSubscription;

        public FirebaseSincronizadorWorker(
            ILogger<FirebaseSincronizadorWorker> logger,
            IServiceProvider serviceProvider,
            IConfiguration configuration)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _firebaseUrl = configuration["FirebaseSettings:DatabaseUrl"]
                ?? "https://firebaseio.com";
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("→ Vigilante en tiempo real de Firebase inicializado correctamente.");

            _firebaseClient = new FirebaseClient(_firebaseUrl);

            // Escuchamos de forma reactiva la raíz de Firebase.
            // FirebaseClient nos devolverá un evento cada vez que un usuario agregue datos en su nodo 'historial'
            _firebaseSubscription = _firebaseClient
                .Child("") // Escucha desde el nodo raíz donde se encuentran los UIDs de los usuarios
                .AsObservable<dynamic>()
                .Subscribe(async nodo =>
                {
                    if (nodo.Object != null && !stoppingToken.IsCancellationRequested)
                    {
                        string UIDUsuarioFirebase = nodo.Key; // Ejemplo: Jkbibl6mwAfJS...
                        _logger.LogInformation($"[Firebase] Evento de actualización detectado en el UID: {UIDUsuarioFirebase}");

                        await ProcesarYJalarAMySQL(UIDUsuarioFirebase);
                    }
                });

            return Task.CompletedTask;
        }

        private async Task ProcesarYJalarAMySQL(string uidUsuario)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<SistemaHBContext>();

                try
                {
                    // 1. Extraer la última medición del historial de este usuario en Firebase
                    var historialNodo = await _firebaseClient
                        .Child(uidUsuario)
                        .Child("historial")
                        .OnceAsync<FirebaseMedicion>();

                    // Tomamos el último registro insertado por orden cronológico en Firebase
                    var ultimaMedicionFirebase = historialNodo
                        .OrderByDescending(x => x.Key)
                        .FirstOrDefault()?.Object;

                    if (ultimaMedicionFirebase == null)
                    {
                        _logger.LogWarning($"[Firebase] El usuario {uidUsuario} no tiene registros en su subnodo 'historial'.");
                        return;
                    }

                    _logger.LogInformation($"[Firebase] Procesando medición: Hb {ultimaMedicionFirebase.Hemoglobina} g/dL, Temp: {ultimaMedicionFirebase.Temperatura}°C");

                    // 2. Vincular el UID de Firebase con tu ID numérico relacional de MySQL.
                    // Para esto buscamos en la tabla de personas de MySQL usando el nombre o correo, o mediante tu tabla intermedia.
                    // REGLA DE SEGURIDAD INTERNA: Buscamos al paciente en MySQL por el nombre capturado de Firebase
                    var perfilFirebase = await _firebaseClient
                        .Child(uidUsuario)
                        .Child("perfil")
                        .OnceSingleAsync<dynamic>();

                    string nombreFirebase = perfilFirebase?.nombre ?? "";
                    string apellidoFirebase = perfilFirebase?.apellido ?? "";

                    var usuarioMySQL = await context.Usuarios
                        .Include(u => u.IdPersonaNavigation)
                        .FirstOrDefaultAsync(u => u.IdPersonaNavigation.Nombre.ToLower() == nombreFirebase.ToString().ToLower()
                                               && u.IdPersonaNavigation.Paterno.ToLower() == apellidoFirebase.ToString().ToLower()
                                               && u.IdPersonaNavigation.Materno.ToLower()==apellidoFirebase.ToString().ToLower());

                    if (usuarioMySQL == null)
                    {
                        _logger.LogWarning($"⚠️ No se encontró ningún usuario en MySQL emparejado con el nombre: {nombreFirebase} {apellidoFirebase}. Sincronización omitida.");
                        return;
                    }

                    // 3. Obtener el rango analítico de referencia (Buscamos por el género del paciente)
                    var rangoCorrespondiente = await context.RangoHemoglobinas
                        .FirstOrDefaultAsync(r => r.IdGenero == usuarioMySQL.IdPersonaNavigation.IdGenero);

                    if (rangoCorrespondiente == null)
                    {
                        _logger.LogWarning($"⚠️ No hay rangos clínicos definidos en MySQL para el género del paciente {usuarioMySQL.IdUsuario}.");
                        return;
                    }

                    // 4. Transformar y formatear la fecha que envía el Hardware ("17/04/2026 20:24") a tipo DateOnly de SQL
                    DateOnly fechaFinalMapeada;
                    try
                    {
                        // Cortamos la cadena de texto para tomar solo la sección de la fecha e ignorar la hora
                        string fechaLimpia = ultimaMedicionFirebase.Fecha.Split(' ')[0]; // Resultado: "17/04/2026"
                        DateTime dt = DateTime.ParseExact(fechaLimpia, "dd/MM/yyyy", CultureInfo.InvariantCulture);
                        fechaFinalMapeada = new DateOnly(dt.Year, dt.Month, dt.Day);
                    }
                    catch
                    {
                        // Fallback de seguridad en caso de que la fecha venga corrupta o en otro formato
                        fechaFinalMapeada = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, DateTime.Today.Day);
                    }

                    // 5. Verificar si este análisis exacto ya fue procesado y guardado previamente en tu MySQL para evitar duplicidades
                    var analisisDuplicado = await context.NivelHemoglobinas
                        .AnyAsync(n => n.IdUsuario == usuarioMySQL.IdUsuario
                                    && n.ValorHemoglobina == ultimaMedicionFirebase.Hemoglobina
                                    && n.FechaAnalisis == fechaFinalMapeada);

                    if (analisisDuplicado)
                    {
                        _logger.LogInformation($"[MySQL] La medición de {ultimaMedicionFirebase.Hemoglobina} g/dL para este día ya existe. No se duplicará.");
                        return;
                    }

                    // 6. Persistir de forma permanente en la tabla 'nivel_hemoglobina' de MySQL
                    var nuevoNivel = new NivelHemoglobina
                    {
                        IdUsuario = usuarioMySQL.IdUsuario,
                        IdRangoHemoglobina = rangoCorrespondiente.IdRango,
                        ValorHemoglobina = ultimaMedicionFirebase.Hemoglobina,
                        FechaAnalisis = fechaFinalMapeada
                    };

                    await context.NivelHemoglobinas.AddAsync(nuevoNivel);
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"✓ Historial clínico sincronizado con éxito en MySQL para el ID de Usuario: {usuarioMySQL.IdUsuario}.");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"❌ Error crítico en el hilo de sincronización automatizada: {ex.Message}");
                }
            }
        }

        public override void Dispose()
        {
            _firebaseSubscription?.Dispose();
            _firebaseClient?.Dispose();
            base.Dispose();
        }
    }
}
