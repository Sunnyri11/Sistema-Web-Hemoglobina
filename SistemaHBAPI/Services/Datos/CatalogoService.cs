using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Datos
{
    public interface ICatalogoService
    {
        Task<Resultado> DepartamentosAsync();
        Task<Resultado> ProvinciasAsync(int idDepartamento);
        Task<Resultado> EspecialidadesAsync();
        Task<Resultado> ObservacionesClinicasAsync();
    }

    /// <summary>Listas de apoyo para los formularios (departamentos, ciudades, especialidades, observaciones).</summary>
    public sealed class CatalogoService : ICatalogoService
    {
        private readonly SistemaHBContext _context;

        public CatalogoService(SistemaHBContext context)
        {
            _context = context;
        }

        public async Task<Resultado> DepartamentosAsync()
        {
            try
            {
                var departamentos = await _context.Departamentos
                    .Select(d => new
                    {
                        idDepartamento = d.IdDepartamento,
                        nombre = d.Departamento1 ?? "Sin Nombre"
                    })
                    .ToListAsync();

                return Resultado.Ok(departamentos);
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new
                {
                    mensaje = "Error al recuperar los departamentos desde la base de datos.",
                    detalle = ex.Message
                });
            }
        }

        public async Task<Resultado> ProvinciasAsync(int idDepartamento)
        {
            if (idDepartamento <= 0)
                return Resultado.BadRequest(new { mensaje = "El ID del departamento proporcionado no es válido." });

            try
            {
                if (!await _context.Departamentos.AnyAsync(d => d.IdDepartamento == idDepartamento))
                    return Resultado.NoEncontrado(new { mensaje = $"El departamento con ID {idDepartamento} no existe en el sistema." });

                var provincias = await _context.Ciudads
                    .Where(c => c.IdDepartamento == idDepartamento)
                    .Select(c => new
                    {
                        idCiudad = c.IdCiudad,
                        nombre = c.Nombre ?? "Sin Nombre",
                        altitud = c.Altitud
                    })
                    .ToListAsync();

                return Resultado.Ok(provincias);
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new
                {
                    mensaje = "Error al recuperar las provincias/ciudades desde la base de datos.",
                    detalle = ex.Message
                });
            }
        }

        public async Task<Resultado> EspecialidadesAsync()
        {
            try
            {
                var especialidades = await _context.Especialidades
                    .Select(d => new
                    {
                        idEspecialidad = d.IdEspecialidad,
                        nombre = d.Nombre ?? "Sin Nombre"
                    })
                    .ToListAsync();

                return Resultado.Ok(especialidades);
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new
                {
                    mensaje = "Error al recuperar el catálogo de especialidades médicas.",
                    detalle = ex.Message
                });
            }
        }

        public async Task<Resultado> ObservacionesClinicasAsync()
        {
            try
            {
                var observaciones = await _context.ObservacionesClinicas
                    .Select(obs => new { Observaciones = obs })
                    .ToListAsync();

                return Resultado.Ok(observaciones);
            }
            catch
            {
                return Resultado.BadRequest();
            }
        }
    }
}
