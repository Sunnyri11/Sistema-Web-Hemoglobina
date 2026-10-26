using System.Security.Claims;

namespace SistemaHBAPI.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        /// <summary>
        /// Id del paciente, médico o administrador (según el rol con el que inició sesión),
        /// guardado en el claim "IdEntidadRol" del JWT. Null si falta o no es válido.
        /// </summary>
        public static int? ObtenerIdEntidad(this ClaimsPrincipal usuario) =>
            int.TryParse(usuario.FindFirst("IdEntidadRol")?.Value, out var id) ? id : null;
    }
}
