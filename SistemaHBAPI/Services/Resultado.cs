using Microsoft.AspNetCore.Mvc;

namespace SistemaHBAPI.Services
{
    /// <summary>
    /// Resultado de un servicio: código HTTP + cuerpo. Permite que los controladores sean delgados
    /// y que las respuestas (códigos y JSON) sigan siendo exactamente las que espera el frontend.
    /// </summary>
    public sealed class Resultado
    {
        public int Codigo { get; }
        public object? Cuerpo { get; }
        public bool Exitoso => Codigo is >= 200 and < 300;

        private Resultado(int codigo, object? cuerpo)
        {
            Codigo = codigo;
            Cuerpo = cuerpo;
        }

        public static Resultado Ok(object? cuerpo = null) => new(StatusCodes.Status200OK, cuerpo);
        public static Resultado BadRequest(object? cuerpo = null) => new(StatusCodes.Status400BadRequest, cuerpo);
        public static Resultado NoAutorizado(object? cuerpo = null) => new(StatusCodes.Status401Unauthorized, cuerpo);
        public static Resultado NoEncontrado(object? cuerpo = null) => new(StatusCodes.Status404NotFound, cuerpo);
        public static Resultado ErrorInterno(object? cuerpo = null) => new(StatusCodes.Status500InternalServerError, cuerpo);
        public static Resultado ConCodigo(int codigo, object? cuerpo = null) => new(codigo, cuerpo);

        public IActionResult ToActionResult() =>
            Cuerpo is null
                ? new StatusCodeResult(Codigo)
                : new ObjectResult(Cuerpo) { StatusCode = Codigo };
    }
}
