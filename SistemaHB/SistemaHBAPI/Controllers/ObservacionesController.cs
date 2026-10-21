using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObservacionesController : Controller
    {

        private readonly SistemaHBContext _context;
        public ObservacionesController(SistemaHBContext _context)
        {
            this._context = _context;   
        }

        [HttpGet("observacionesclinicas")]
        public async Task<IActionResult> Observacionesclinicas()
        {
            try
            {
                var observaciones = await (from obs in _context.ObservacionesClinicas
                                     select new
                                     {
                                         Observaciones = obs
                                     }).ToListAsync();
                return Ok(observaciones);
            }
            catch
            {
                return BadRequest();
            }
        }
    }
}
