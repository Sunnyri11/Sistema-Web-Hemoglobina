using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Usuarios
{
    public interface IAdministradorService
    {
        Task<Resultado> MisDatosAsync(int idAdministrador);
    }

    public sealed class AdministradorService : IAdministradorService
    {
        private readonly SistemaHBContext _context;

        public AdministradorService(SistemaHBContext context)
        {
            _context = context;
        }

        public async Task<Resultado> MisDatosAsync(int idAdministrador)
        {
            try
            {
                var administrador = await _context.Administradors.FirstOrDefaultAsync(e => e.IdAdministrador == idAdministrador);
                if (administrador == null)
                    return Resultado.BadRequest(new { mensaje = "La persona existe, pero no está configurada como administrador." });

                var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == administrador.IdPersona);
                return Resultado.Ok(new { Administrador = administrador, Usuario = persona });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }
    }
}
