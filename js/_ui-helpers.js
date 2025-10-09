/*
==================================================================
ARCHIVO: planespro/formulario/js/_ui-helpers.js
==================================================================
*/

// Funciones dedicadas a la manipulación de la interfaz de usuario (UI).
import { DOM } from './_dom-elements.js';

let formStepsNum = 0; // Estado local para el paso actual

export function getFormStepNum() {
    return formStepsNum;
}

export function setFormStepNum(num) {
    formStepsNum = num;
}

// --- FUNCIÓN openModal (VERSIÓN DEFINITIVA Y ROBUSTA) ---
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // SOLUCIÓN: Revisa si el modal mismo O un elemento hijo tiene la clase 'warning-modal'.
        // Esto hace que funcione tanto para los modales originales como para los nuevos.
        if (modal.classList.contains('warning-modal') || modal.querySelector('.warning-modal')) {
            modal.classList.add('warning-modal'); // Se asegura de que el contenedor principal la tenga.
        }
        
        modal.classList.add('is-visible');
        document.body.classList.add('no-scroll');
    }
}

// planespro/formulario/js/_ui-helpers.js

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('is-visible');

        if (document.querySelectorAll('.modal.is-visible').length === 0) {
            document.body.classList.remove('no-scroll');
        }

        // Resetea el formulario y su estado visual por completo
        if (modalId === 'formModal') {
            // Limpieza de datos y campos
            if (DOM.leadForm) DOM.leadForm.reset();
            
            // --- INICIO DE LAS CORRECCIONES ---

            // CORRECCIÓN 1: Reiniciar el modal de bienvenida
            const consentCheckbox = document.getElementById('consent-checkbox');
            const continueBtn = document.getElementById('continue-btn');
            if (consentCheckbox) consentCheckbox.checked = false;
            if (continueBtn) continueBtn.disabled = true;

            // CORRECCIÓN 2 y 3: Ocultar campos condicionales de Isapre y AFP
            const isapreDetails = document.getElementById('isapre-details');
            const afpDetails = document.getElementById('afp-details');
            if (isapreDetails) isapreDetails.classList.remove('is-visible');
            if (afpDetails) afpDetails.classList.remove('is-visible');

            // Limpia la vista previa del archivo adjunto
            const filePreview = document.getElementById('file-preview');
            const fileLabel = document.querySelector('.file-upload-label');
            if (filePreview && fileLabel) {
                filePreview.innerHTML = '';
                filePreview.classList.add('hidden');
                fileLabel.classList.remove('hidden');
            }

            // --- FIN DE LAS CORRECCIONES ---

            // Reseteo visual del formulario a su estado inicial
            setFormStepNum(0);
            updateFormView();
            document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
            document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
            
            const submissionError = document.getElementById('submission-error');
            if (submissionError) submissionError.classList.remove('visible');
            
            const header = document.querySelector('#formModal .modal-header');
            if(header) header.classList.remove('scrolled');
        }
    }
}


export function updateProgressbar() {
    if (!DOM.progressSteps || !DOM.progressLine) return; 
    DOM.progressSteps.forEach((step, idx) => {
        step.classList.toggle("active", idx <= formStepsNum);
    });
    const progressPercentage = formStepsNum === 0 ? 0 : (formStepsNum / (DOM.progressSteps.length - 1)) * 100;
    DOM.progressLine.style.width = `${progressPercentage}%`;
}

export function updateFormView(direction = 'next') {
    const modalBody = document.querySelector('#formModal .modal-body'); 
    if (!DOM.formSteps || DOM.formSteps.length === 0) return; 

    DOM.formSteps.forEach(step => {
        step.classList.remove("active", "slide-in-right", "slide-in-left");
    });
    
    const currentStep = DOM.formSteps[formStepsNum];
    if (!currentStep) return;

    currentStep.classList.add("active");
    if (direction === 'next') {
        currentStep.classList.add('slide-in-right');
    } else {
        currentStep.classList.add('slide-in-left');
    }
    
    requestAnimationFrame(() => {
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
        const firstInput = currentStep.querySelector('input:not([type="hidden"]), select');
        if (firstInput) {
            firstInput.focus({ preventScroll: true });
        }
    });
    
    updateProgressbar();
}

export function showFilePreview(file) {
    const previewWrapper = document.getElementById('file-preview');
    const uploadLabel = document.querySelector('.file-upload-label');
    const errorDiv = document.getElementById('error-pdf_file');

    if (!previewWrapper || !uploadLabel || !errorDiv) return;

    errorDiv.classList.remove('visible');
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    previewWrapper.innerHTML = '';
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-pdf';
    const text = document.createElement('span');
    text.textContent = `${file.name} (${fileSize} MB)`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.setAttribute('aria-label', 'Eliminar archivo');
    removeBtn.innerHTML = '&times;';
    
    removeBtn.addEventListener('click', () => {
        const pdfFileInput = document.getElementById('pdf_file');
        if (pdfFileInput) pdfFileInput.value = '';
        previewWrapper.classList.add('hidden');
        previewWrapper.innerHTML = '';
        uploadLabel.classList.remove('hidden');
    });

    const successIcon = document.createElement('i');
    successIcon.className = 'fas fa-check-circle';

    previewWrapper.append(icon, text, removeBtn, successIcon);
    previewWrapper.classList.remove('hidden');
    uploadLabel.classList.add('hidden');
}

// AÑADIR AL FINAL DE _ui-helpers.js

const WHATSAPP_EXEC = '56967313656'; // Reemplaza con tu número si es diferente

function formDataToObject(fd) {
  const out = {};
  for (const [k, v] of fd.entries()) {
    out[k] = v;
  }
  return out;
}

// REEMPLAZA LA FUNCIÓN COMPLETA en js/_ui-helpers.js

// REEMPLAZA la función buildWhatsAppPayloadFromForm en _ui-helpers.js
// REEMPLAZAR LA FUNCIÓN COMPLETA en js/_ui-helpers.js

export function buildWhatsAppPayloadFromForm(formEl) {
    const fd = new FormData(formEl);
    const hasPDF = formEl.querySelector('#pdf_file')?.files?.length > 0;

    fd.delete('pdf_file');
    fd.delete('archivo_pdf');
    fd.delete('base64pdf');
    fd.delete('filename');

    const d = formDataToObject(fd);
    const lines = [
        'IMPORTANTE: NO EDITAR ESTE MENSAJE.',
        'Envíalo para que el ejecutivo reciba tus datos.',
        '',
        d.nombre ? `Hola, soy ${d.nombre}.` : 'Hola.',
    ];
    const push = (label, value) => { if (value) lines.push(`• ${label}: ${value}`); };

    push('Certificado Adjunto', hasPDF ? 'Sí' : 'No');
    push('RUT', d.rut);
    push('Email', d.email);
    push('Teléfono', d.telefono);
    push('Edad', d.rango_edad);
    push('Estado civil', d.estado_civil);
    push('Comuna', d.comuna);
    push('Región', d.region);
    push('Sistema de Salud', d.sistema_actual === 'Isapre' ? `Isapre (${d.isapre_especifica || 'No especificada'})` : d.sistema_actual);
    push('Anualidad Isapre', d.anualidad_isapre);
    push('Estatura', d.estatura ? `${d.estatura} m` : '');
    push('Peso', d.peso ? `${d.peso} Kg` : '');
    push('Cargas', d.num_cargas);
    push('Edad Cargas', d.edad_cargas);
    push('Costo plan actual', d.rango_costo);
    push('Interés', d.interes);
    push('Evaluar AFP', d.evaluar_afp);

    if (d.evaluar_afp === 'Si') {
        push('AFP actual', d.afp_actual);
    }

    lines.push('', 'Gracias por tu confianza. Pronto te entregamos tu análisis.');
    
    const text = lines.join('\n');
    
    // --- INICIO DE LA LÓGICA MEJORADA ---

    // Función para detectar si es un dispositivo móvil
    const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let url;
    if (isMobile()) {
        // Enlace directo a la app para móviles (más robusto)
        url = `whatsapp://send?phone=${WHATSAPP_EXEC}&text=${encodeURIComponent(text)}`;
    } else {
        // Enlace web para escritorio
        url = `https://wa.me/${WHATSAPP_EXEC}?text=${encodeURIComponent(text)}`;
    }
    return { url, text };
}