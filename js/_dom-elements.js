/*
==================================================================
ARCHIVO: planespro/formulario/js/_dom-elements.js
==================================================================
*/

// Centraliza las referencias a elementos del DOM para un fácil acceso y mantenimiento.

// Objeto que contendrá todos los elementos. Se exporta para ser usado en otros módulos.
export const DOM = {};

// ====== INICIO DE LA MODIFICACIÓN: Limpieza de referencias obsoletas ======

// ANTERIOR:
// No se muestra el código anterior, ya que la modificación es una simple limpieza.

// NUEVO:
// Se han eliminado las referencias a elementos que ya no existen en el HTML,
// como los disparadores del selector móvil.

// EXPLICACIÓN:
// Mantener este archivo actualizado y limpio es una buena práctica. Previene errores
// en el futuro si otro script intenta acceder a un elemento que ya no está en la página.

/**
 * Busca y asigna todos los elementos del DOM necesarios una vez que han sido cargados.
 * Esta función debe llamarse después de que los módulos HTML están en la página.
 */
export function setElements() {
    DOM.leadForm = document.getElementById('leadForm');
    DOM.formSteps = document.querySelectorAll(".form-step");
    DOM.progressSteps = document.querySelectorAll(".progress-step");
    DOM.progressLine = document.querySelector(".progress-bar .progress-line-fg");
    
    // Referencias al modal de bienvenida
    DOM.consentCheckbox = document.getElementById('consent-checkbox');
    DOM.continueBtn = document.getElementById('continue-btn');

    // Referencias a campos específicos del formulario
    DOM.rutInput = document.getElementById('rut');
    DOM.estaturaSlider = document.getElementById('estatura');
    DOM.estaturaOutput = document.getElementById('estatura-output');
    DOM.pesoSlider = document.getElementById('peso');
    DOM.pesoOutput = document.getElementById('peso-output');
    DOM.pdfFileInput = document.getElementById('pdf_file');
}

// ====== FIN DE LA MODIFICACIÓN ======