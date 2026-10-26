using System;
using System.Collections.Generic;
using System.Text;

namespace BibliotecaSistemaHB
{
    public class FirebaseMedicion
    {
        public string Estado { get; set; } = string.Empty;
        public string Fecha { get; set; } = string.Empty; 
        public decimal Hemoglobina { get; set; }
        public decimal Temperatura { get; set; }
    }
}
