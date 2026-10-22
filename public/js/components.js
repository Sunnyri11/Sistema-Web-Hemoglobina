document.addEventListener("DOMContentLoaded", () => {
    // 1. Inicializar automáticamente el comportamiento del Menú Hamburguesa si existe en la página
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            navToggle.classList.toggle('open');
        });

        // Cerrar el menú al hacer clic en cualquier opción
        navLinks.querySelectorAll('button, a').forEach(item => {
            item.addEventListener('click', () => {
                navLinks.classList.remove('active');
                navToggle.classList.remove('open');
            });
        });

        // Cerrar el menú al hacer clic fuera de él
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('active');
                navToggle.classList.remove('open');
            }
        });
    }
});