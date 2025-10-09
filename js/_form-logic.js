/*
==================================================================
ARCHIVO: _form-logic.js (Versión Final, Completa y Funcional)
==================================================================
*/

import { DOM } from './_dom-elements.js';
import {
    openModal,
    closeModal,
    updateFormView,
    showFilePreview,
    getFormStepNum,
    setFormStepNum,
    buildWhatsAppPayloadFromForm
} from './_ui-helpers.js';
import { isCurrentStepValid, isFullFormValid, validateField } from './_form-validation.js';
import { comunasRegiones, LOCAL_STORAGE_KEY } from './_config.js';

// --- URL de tu Google Apps Script ---
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxvFi7_F5r0Q1ziw1qn_cSV7sCs4KM5Mp5Qx6KvkmzOZLaFPpnEqEz5v2BDLLRctgCPtA/exec';

// --- Variables de estado ---
let ctaFuente = '';
let edadCargasData = '';
let factorData = '';
let isRecoveredSession = false;
let isSubmitting = false; // <-- SOLUCIÓN AL BUG #2 (Línea añadida)

/**
 * Revisa si existe un progreso guardado al iniciar la app
 * y activa la bandera de sesión recuperada.
 * Se exporta para ser llamada desde main.js
 */
export function checkRecoveryStatus() {
    if (localStorage.getItem(LOCAL_STORAGE_KEY)) {
        isRecoveredSession = true;
    }
}

// --- Constantes ---
const FACTOR_POR_EDAD = {
  "18-25": "0.9", "26-35": "1.0", "36-45": "1.3",
  "46-55": "1.4", "56-64": "2.0", "65+": "2.4"
};

// --- Funciones auxiliares para el modal de "Gracias" ---
function setThankyouHeader(state) {
  const titleEl = document.getElementById('thankyou-modal-title');
  if (!titleEl) return;
  if (state === 'processing') {
    titleEl.innerHTML = '<i class="fas fa-paper-plane"></i> Enviando...';
  } else {
    titleEl.innerHTML = '<i class="fas fa-check-circle"></i> ¡Listo! Solicitud enviada';
  }
}

// --- FUNCIÓN PARA CÁLCULO DE SIMILITUD DE TEXTO (LEVENSHTEIN) ---
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,          // Deletion
                matrix[j - 1][i] + 1,          // Insertion
                matrix[j - 1][i - 1] + cost    // Substitution
            );
        }
    }
    return matrix[b.length][a.length];
}

function showThankyouProcessing() {
  setThankyouHeader('processing');
  const processing = document.getElementById('thankyou-processing');
  const success = document.getElementById('thankyou-success');
  if(processing) processing.style.display = 'block';
  if(success) success.style.display = 'none';
}

function showThankyouSuccess(waURL, waText) {
  setThankyouHeader('success');
  const processing = document.getElementById('thankyou-processing');
  const success = document.getElementById('thankyou-success');
  if(processing) processing.style.display = 'none';
  if(success) success.style.display = 'block';
  
  const waBtn = document.getElementById('thankyou-wa-btn');
  if(waBtn) waBtn.href = waURL || '#';

  const copyLink = document.getElementById('thankyou-copy-link');
  const tooltip = document.getElementById('thankyou-tooltip');
  if (copyLink) {
    copyLink.onclick = async (ev) => {
        ev.preventDefault();
        try {
            await navigator.clipboard.writeText(waText || '');
            if (tooltip) {
                tooltip.textContent = '¡Copiado!';
                tooltip.style.opacity = '1';
                setTimeout(() => { tooltip.style.opacity = '0'; tooltip.textContent = ''; }, 1500);
            }
        } catch(err) { console.error('Error al copiar:', err); }
    };
  }
}

// --- Funciones de Lógica de UI ---
export function updateActionButtonState() {
    if (!DOM.formSteps || DOM.formSteps.length === 0) return;
    const currentStep = DOM.formSteps[getFormStepNum()];
    if (!currentStep) return;
    const actionBtn = currentStep.querySelector('.next-btn, .submit-btn');
    if (actionBtn) {
        actionBtn.disabled = !isCurrentStepValid();
    }
}

const debounce = (func, delay = 300) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => { func.apply(this, args); }, delay);
    };
};

export const saveProgress = debounce(() => {
    if (isSubmitting) return; // <-- SOLUCIÓN AL BUG #2 (Línea añadida)
    if (!DOM.leadForm) return;
    const formData = new FormData(DOM.leadForm);
    const data = Object.fromEntries(formData.entries());
    ['anualidad_isapre', 'evaluar_afp'].forEach(name => {
        const radioChecked = DOM.leadForm.querySelector(`input[name="${name}"]:checked`);
        if (radioChecked) data[name] = radioChecked.value;
    });
    data.currentStep = getFormStepNum();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}, 400);

export function loadProgress() {
    try {
        if (!DOM.leadForm) return;
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!savedData) return;
        const data = JSON.parse(savedData);
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const field = DOM.leadForm.querySelector(`[name="${key}"]`);
                if (field) {
                    if (field.type === 'radio') {
                        const radioToSelect = DOM.leadForm.querySelector(`[name="${key}"][value="${data[key]}"]`);
                        if (radioToSelect) radioToSelect.checked = true;
                    } else {
                        field.value = data[key];
                        if (field.type === 'range') field.dispatchEvent(new Event('input'));
                    }
                }
            }
        }

        const savedStep = parseInt(data.currentStep, 10);
        if (!isNaN(savedStep) && savedStep > 0) {
            setFormStepNum(savedStep);
            updateFormView(); 
            DOM.progressSteps.forEach((step, index) => {
                if (index < savedStep) {
                    step.classList.add('completed');
                }
            });
        }

        document.getElementById('sistema_actual')?.dispatchEvent(new Event('change'));
        document.getElementById('comuna')?.dispatchEvent(new Event('change'));
        document.querySelector('input[name="evaluar_afp"]:checked')?.dispatchEvent(new Event('change'));
    } catch (error) {
        console.error("Error al cargar el progreso:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}

function formatRut(rut) {
    rut = rut.replace(/[^\dkK]/g, '');
    rut = rut.replace(/^0+/, '');
    if (rut.length > 1) {
        let body = rut.slice(0, -1);
        let dv = rut.slice(-1).toUpperCase();
        body = new Intl.NumberFormat('de-DE').format(body);
        return `${body}-${dv}`;
    }
    return rut.toUpperCase();
}

function getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

// --- Lógica de Inicialización de Modales y Navegación ---
export function initModals() {
    document.body.addEventListener('click', e => {
        const trigger = e.target.closest('[data-modal-trigger]');
        if (trigger && trigger.id) {
            ctaFuente = trigger.id;
        }
    });

    document.body.addEventListener('click', e => {
        const button = e.target.closest('button');
        if (button) {
            const buttonId = button.id;
            switch (buttonId) {
                case 'continue-btn':
                    if (document.getElementById('consent-checkbox')?.checked) {
                        closeModal('welcomeModal');
                        openModal('formModal');
                        setFormStepNum(0);
                        updateFormView();
                        history.pushState({ inForm: true }, 'Formulario');
                    }
                    break;
                case 'main-close-btn':
                    openModal('exitConfirmModal');
                    break;
                case 'exit-confirm-continue':
                case 'isapre-warning-accept':
                    closeModal(button.closest('.modal').id);
                    break;
                case 'exit-confirm-exit':
                    closeModal('exitConfirmModal');
                    closeModal('formModal');
                    document.getElementById('recovery-screen').style.display = 'grid';
                    break;
            }
        }
    });

    const consentCheckbox = document.getElementById('consent-checkbox');
    if (consentCheckbox) {
      consentCheckbox.addEventListener('change', () => { 
        document.getElementById('continue-btn').disabled = !consentCheckbox.checked; 
      });
    }

    window.addEventListener('popstate', (event) => {
      if (document.getElementById('formModal')?.classList.contains('is-visible') && event.state && event.state.inForm) {
        openModal('exitConfirmModal');
        history.pushState({ inForm: true }, 'Formulario');
      }
    });
}

export function initStepNavigation() {
    if (!DOM.leadForm) return;
    const progressBar = document.querySelector('.progress-bar');

    DOM.leadForm.addEventListener('click', (e) => {
        if (e.target.matches('.next-btn')) {
            const currentStep = DOM.formSteps[getFormStepNum()];
            let allValid = true;
            currentStep.querySelectorAll('input[required], select[required]').forEach(field => {
                const formGroup = field.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.add('is-interacted');
                    if (!validateField(field)) allValid = false;
                }
            });
            if (allValid) {
                const currentStepNum = getFormStepNum();
                if (currentStepNum < DOM.formSteps.length - 1) {
                    DOM.progressSteps[currentStepNum].classList.add('completed');
                    setFormStepNum(currentStepNum + 1);
                    updateFormView('next');
                }
            } else {
                currentStep.querySelector('.input-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (e.target.matches('.prev-btn')) {
            let currentStep = getFormStepNum();
            if (currentStep > 0) {
                setFormStepNum(currentStep - 1);
                updateFormView('prev');
            }
        }
    });

    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            const targetStepElement = e.target.closest('.progress-step');
            if (targetStepElement && targetStepElement.classList.contains('completed')) {
                const stepIndex = Array.from(DOM.progressSteps).indexOf(targetStepElement);
                if (stepIndex !== -1) {
                    const direction = stepIndex < getFormStepNum() ? 'prev' : 'next';
                    setFormStepNum(stepIndex);
                    updateFormView(direction);
                }
            }
        });
    }
}

export function handleFieldInteraction(e) {
    const field = e.target;
    const formGroup = field.closest('.form-group');
    if (e.type === 'focusout') {
        formGroup?.classList.add('is-interacted');
        validateField(field);
    } else if (e.type === 'input' || e.type === 'change') {
        if (formGroup?.classList.contains('is-interacted')) {
            validateField(field);
        }
    }
    updateActionButtonState();
    saveProgress();
}

const sendAbandonedData = () => {
    const progress = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (progress && Object.keys(JSON.parse(progress)).length > 0) {
        const data = JSON.parse(progress);
        data.status = 'Abandonado';
        const urlParams = new URLSearchParams(window.location.search);
        data.fuente_cta = urlParams.get('fuente') || ctaFuente || 'Orgánico';
        data.campana = urlParams.get('campana') || 'No especificado';
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }
        if (WEB_APP_URL && !WEB_APP_URL.includes('PEGA_AQUÍ')) {
            navigator.sendBeacon(WEB_APP_URL, formData);
        }
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
};

export function initFormEventListeners() {
    if (!DOM.leadForm) return;
    DOM.leadForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const currentStep = DOM.formSteps[getFormStepNum()];
            const actionBtn = currentStep.querySelector('.next-btn, .submit-btn');
            if (actionBtn && !actionBtn.disabled) actionBtn.click();
        }
    });
    DOM.leadForm.addEventListener('focusout', handleFieldInteraction);
    DOM.leadForm.addEventListener('input', handleFieldInteraction);
    DOM.leadForm.addEventListener('change', handleFieldInteraction);
    const modalBody = document.querySelector('#formModal .modal-body');
    if (modalBody) {
        modalBody.addEventListener('scroll', () => {
            document.querySelector('#formModal .modal-header')?.classList.toggle('scrolled', modalBody.scrollTop > 0);
        });
    }
    window.addEventListener('pagehide', sendAbandonedData);
}

export function initDynamicFields() {
    if (!DOM.leadForm) return;
    DOM.leadForm.addEventListener('input', (e) => {
        const target = e.target;
        if (target.id === 'rut') {
            target.value = formatRut(target.value);
            const icon = document.getElementById('rut-validation-icon');
            if (icon) {
                const rutIsValid = (() => {
                    const rutCompleto = target.value;
                    if (!/^[0-9]+-[0-9kK]{1}$/.test(rutCompleto.replace(/\./g, ''))) return false;
                    const [cuerpo, dv] = rutCompleto.replace(/\./g, '').split('-');
                    let suma = 0, multiplo = 2;
                    for (let i = cuerpo.length - 1; i >= 0; i--) {
                        suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
                        multiplo = multiplo === 7 ? 2 : multiplo + 1;
                    }
                    const dvEsperado = 11 - (suma % 11);
                    const dvCalculado = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : dvEsperado.toString();
                    return dvCalculado === dv.toUpperCase();
                })();
                icon.classList.toggle('is-visible', rutIsValid);
            }
        }
        if (target.id === 'estatura') {
            if (!target.hasAttribute('name')) {
                target.setAttribute('name', 'estatura');
            }
            if (DOM.estaturaOutput) DOM.estaturaOutput.textContent = `${parseFloat(target.value).toFixed(2)} m`;
        }
        if (target.id === 'peso') {
             if (!target.hasAttribute('name')) {
                target.setAttribute('name', 'peso');
            }
            if (DOM.pesoOutput) DOM.pesoOutput.textContent = `${target.value} Kg`;
        }
    });

    DOM.leadForm.addEventListener('change', e => {
        const target = e.target;
        if (target.id === 'pdf_file') {
            handleFileUpload(target);
        }
        if (target.id === 'sistema_actual') {
            const isapreDetails = document.getElementById('isapre-details');
            if (isapreDetails) {
                const isIsapre = target.value === 'Isapre';
                isapreDetails.classList.toggle('is-visible', isIsapre);
                isapreDetails.querySelectorAll('select, input[type="radio"]').forEach(field => field.required = isIsapre);
            }
        }
        if (target.closest('#anualidad-isapre-group') && target.value === 'No') {
            const isapreName = document.getElementById('isapre_especifica').value;
            if (isapreName) {
                const msg = isapreName === 'Otra' ? `Recuerde que debe tener al menos un año en "Tu Isapre actual".` : `Recuerde que debe tener al menos un año en "${isapreName}".`;
                const warningText = document.getElementById('isapre-warning-text');
                if(warningText) warningText.textContent = msg;
                openModal('isapreWarningModal');
            }
        }
        if (target.closest('#afp-radio-group')) {
            const afpDetails = document.getElementById('afp-details');
            if (afpDetails) {
                const wantsAfpChange = target.value === 'Si';
                afpDetails.classList.toggle('is-visible', wantsAfpChange);
                document.getElementById('afp_actual').required = wantsAfpChange;
                updateActionButtonState();
            }
        }
        if (target.id === 'rango_edad') {
            factorData = FACTOR_POR_EDAD[target.value] || '';
        }
        if (target.id === 'num_cargas') {
            const numCargas = parseInt(target.value.replace('+', ''), 10);
            if (isNaN(numCargas) || numCargas === 0) {
                edadCargasData = '';
                document.getElementById('edad_cargas_hidden').value = '';
            } else {
                openEdadCargasModal(numCargas);
            }
        }
    });
    initComunaAutocomplete();
}

function initComunaAutocomplete() {
    const comunaInput = document.getElementById('comuna');
    if (!comunaInput) return;
    const regionInput = document.getElementById('region');
    let suggestionsContainer = null;
    const allComunas = Object.keys(comunasRegiones).sort();

    // Función para normalizar texto (minúsculas y sin tildes)
    const normalizeText = (text) => {
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Función para seleccionar una comuna y actualizar la UI
    const selectComuna = (comunaName) => {
        comunaInput.value = comunaName;
        if (regionInput) {
            regionInput.value = comunasRegiones[comunaName] || '';
        }
        comunaInput.closest('.form-group')?.classList.add('is-interacted');
        validateField(comunaInput);
        hideSuggestions();
        updateActionButtonState();
    };

    const showSuggestions = (suggestions) => {
        hideSuggestions();
        if (suggestions.length === 0) return;
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'autocomplete-suggestions';
        suggestions.forEach(comuna => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = comuna;
            item.addEventListener('click', () => {
                selectComuna(comuna);
            });
            suggestionsContainer.appendChild(item);
        });
        comunaInput.parentNode.appendChild(suggestionsContainer);
    };

    const hideSuggestions = () => {
        if (suggestionsContainer) {
            suggestionsContainer.remove();
            suggestionsContainer = null;
        }
    };

    // Muestra sugerencias mientras se escribe
    comunaInput.addEventListener('input', debounce(() => {
        const value = comunaInput.value;
        if (!value) {
            hideSuggestions();
            return;
        }
        const lowerTerm = normalizeText(value);
        const filtered = allComunas.filter(comuna =>
            normalizeText(comuna).includes(lowerTerm)
        ).slice(0, 8);
        showSuggestions(filtered);
    }));

    // Lógica inteligente al salir del campo (blur)
    comunaInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSuggestions();
            const userInput = comunaInput.value.trim();
            if (userInput === '') {
                validateField(comunaInput); // Valida si el campo está vacío
                return;
            }

            const normalizedInput = normalizeText(userInput);
            let bestMatch = null;
            let minDistance = Infinity;

            // Busca la comuna con la menor distancia de Levenshtein
            for (const comuna of allComunas) {
                const distance = getLevenshteinDistance(normalizedInput, normalizeText(comuna));
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = comuna;
                }
                // Si hay coincidencia exacta (ignorando mayúsculas/tildes), la usamos y salimos
                if (distance === 0) {
                    break;
                }
            }

            // Umbral de error: Aceptamos corrección si el error es de 1 carácter o es una coincidencia exacta (0).
            const ERROR_THRESHOLD = 1;
            if (bestMatch && minDistance <= ERROR_THRESHOLD) {
                selectComuna(bestMatch); // Autocorrige y selecciona la mejor coincidencia
            } else {
                // Si no hay una coincidencia clara, simplemente valida el campo
                comunaInput.closest('.form-group')?.classList.add('is-interacted');
                validateField(comunaInput);
                updateActionButtonState();
            }
        }, 150); // Pequeño delay para permitir el clic en sugerencias
    });
}

function openEdadCargasModal(numCargas) {
    const modalId = 'edadCargasModal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal is-visible warning-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    let inputsHtml = '';
    for (let i = 1; i <= numCargas; i++) {
        inputsHtml += `
            <div class="form-group">
                <label for="edad_carga_${i}">Edad Carga ${i}*</label>
                <input type="number" id="edad_carga_${i}" class="edad-carga-input" min="0" max="120" required placeholder="Ej: 5">
                <div class="error-message">Completa este campo</div>
            </div>`;
    }
    modal.innerHTML = `
        <div class="modal-content">
             <div class="modal-header"><h3><i class="fas fa-child"></i> Ingresa las Edades</h3></div>
            <div class="modal-body">
                <form id="edadCargasForm" novalidate>
                    <p>Por favor, ingresa la edad de cada una de tus ${numCargas} cargas.</p>
                    ${inputsHtml}
                    <div class="modal-actions"><button type="submit" class="cta-btn-primary">Confirmar Edades</button></div>
                </form>
            </div>
        </div>`;
    document.body.appendChild(modal);
    
    modal.querySelector('#edadCargasForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = modal.querySelectorAll('.edad-carga-input');
        let allValid = true;
        const edades = [];
        inputs.forEach(input => {
            const formGroup = input.closest('.form-group');
            const errorDiv = formGroup.querySelector('.error-message');
            if (input.value.trim() === '') {
                allValid = false;
                formGroup.classList.add('input-error');
                if (errorDiv) errorDiv.classList.add('visible');
            } else {
                formGroup.classList.remove('input-error');
                if (errorDiv) errorDiv.classList.remove('visible');
                edades.push(input.value);
            }
        });
        if (!allValid) return;
        edadCargasData = edades.join(', ');
        document.getElementById('edad_cargas_hidden').value = edadCargasData;
        modal.remove();
    });
}

export function handleFileUpload(fileInput) {
    const errorDiv = document.getElementById('error-pdf_file');
    const file = fileInput.files[0];
    if (!errorDiv) return;
    errorDiv.textContent = '';
    errorDiv.classList.remove('visible');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        errorDiv.textContent = `El archivo es demasiado grande (máx. 5 MB).`;
        errorDiv.classList.add('visible');
        fileInput.value = '';
        return;
    }
    if (file.type !== "application/pdf") {
        errorDiv.textContent = 'Solo se permiten archivos PDF.';
        errorDiv.classList.add('visible');
        fileInput.value = '';
        return;
    }
    showFilePreview(file);
}

async function sendDataToGoogleScript(formData) {
    if (!WEB_APP_URL || WEB_APP_URL.includes('PEGA_AQUÍ')) {
        console.error("URL de Google Apps Script no configurada.");
        return { success: false };
    }
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: formData,
            redirect: 'manual'
        });
        if (response.type === 'opaqueredirect' || response.ok) {
            return { success: true };
        }
        const errorData = await response.json().catch(() => null);
        console.error("Error del servidor al enviar datos:", errorData || response.statusText);
        return { success: false };
    } catch (error) {
        console.error("Error de red al enviar datos:", error);
        return { success: false };
    }
}

// --- LÓGICA DE ENVÍO DEL FORMULARIO ---

async function performSubmission() {
    isSubmitting = true; // <-- SOLUCIÓN AL BUG #2 (Línea añadida)
    const submitButton = DOM.leadForm.querySelector('.submit-btn');
    const submissionErrorDiv = document.getElementById('submission-error');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const { url: waURL, text: waText } = buildWhatsAppPayloadFromForm(DOM.leadForm);

    openModal('thankyou-modal');
    showThankyouProcessing();

    try {
        const formData = new FormData(DOM.leadForm);
        const urlParams = new URLSearchParams(window.location.search);
        formData.append('fuente_cta', urlParams.get('fuente') || ctaFuente || 'Orgánico');
        formData.append('campana', urlParams.get('campana') || 'No especificado');
        formData.append('factor', factorData || 'No calculado');

        if (isRecoveredSession) { // <-- SOLUCIÓN AL BUG #1 (Condición modificada)
            formData.append('status', 'Recuperado');
        }

        if (DOM.pdfFileInput && DOM.pdfFileInput.files.length > 0) {
            const file = DOM.pdfFileInput.files[0];
            const extension = file.name.slice(file.name.lastIndexOf("."));
            const rutValue = DOM.rutInput ? DOM.rutInput.value.replace(/\./g, "").replace("-", "") : '';
            const customName = `${getFormattedDateTime()}_${rutValue}${extension}`;
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            formData.append("base64pdf", base64);
            formData.append("filename", customName);
        }

        localStorage.removeItem(LOCAL_STORAGE_KEY);
        const { success } = await sendDataToGoogleScript(formData);

        if (success) {
            closeModal('formModal');
            showThankyouSuccess(waURL, waText);
        } else {
            if (submissionErrorDiv) {
                submissionErrorDiv.textContent = 'Hubo un error al enviar. Por favor, inténtelo de nuevo.';
                submissionErrorDiv.classList.add('visible');
            }
            closeModal('formModal');
            showThankyouSuccess(waURL, waText);
        }
    } catch (error) {
        console.error("Error de envío:", error);
        closeModal('formModal');
        showThankyouSuccess(waURL, waText);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Obtener Análisis';
        }
    }
}

export function initFormSubmission() {
    if (!DOM.leadForm) return;

    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'pdf-warning-upload') {
            closeModal('pdfWarningModal');
            document.getElementById('pdf_file')?.click();
        }
        if (e.target.id === 'pdf-warning-skip') {
            closeModal('pdfWarningModal');
            performSubmission();
        }
    });

    DOM.leadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isFullFormValid()) return;

        if (DOM.pdfFileInput && DOM.pdfFileInput.files.length === 0) {
            openModal('pdfWarningModal');
            return;
        }
        performSubmission();
    });
}