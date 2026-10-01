/**
 * Catálogo de países para el indicativo telefónico del cliente.
 *
 * Cada país define su indicativo (code, ej. "+57"), nombre y la cantidad de
 * dígitos esperada del número local (digits). La validación del formulario usa
 * `digits` para exigir la longitud correcta según el país. Colombia va primero
 * por ser el caso principal.
 *
 * Nota: NO usamos banderas emoji porque Windows no las renderiza (muestra las
 * iniciales del país). En su lugar se muestra el código ISO + indicativo + nombre.
 */

export interface PhoneCountry {
    /** Indicativo internacional, ej. "+57". Se guarda en el campo phoneCountry. */
    code: string;
    /** Código ISO de 2 letras, ej. "CO". Para mostrar de forma compacta. */
    iso: string;
    /** Nombre del país. */
    name: string;
    /** Cantidad de dígitos esperada del número local (sin indicativo). */
    digits: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
    // Caso principal primero.
    { code: "+57", iso: "CO", name: "Colombia", digits: 10 },

    // Latinoamérica
    { code: "+54", iso: "AR", name: "Argentina", digits: 10 },
    { code: "+591", iso: "BO", name: "Bolivia", digits: 8 },
    { code: "+55", iso: "BR", name: "Brasil", digits: 11 },
    { code: "+56", iso: "CL", name: "Chile", digits: 9 },
    { code: "+506", iso: "CR", name: "Costa Rica", digits: 8 },
    { code: "+53", iso: "CU", name: "Cuba", digits: 8 },
    { code: "+593", iso: "EC", name: "Ecuador", digits: 9 },
    { code: "+503", iso: "SV", name: "El Salvador", digits: 8 },
    { code: "+502", iso: "GT", name: "Guatemala", digits: 8 },
    { code: "+504", iso: "HN", name: "Honduras", digits: 8 },
    { code: "+52", iso: "MX", name: "México", digits: 10 },
    { code: "+505", iso: "NI", name: "Nicaragua", digits: 8 },
    { code: "+507", iso: "PA", name: "Panamá", digits: 8 },
    { code: "+595", iso: "PY", name: "Paraguay", digits: 9 },
    { code: "+51", iso: "PE", name: "Perú", digits: 9 },
    { code: "+1", iso: "PR", name: "Puerto Rico", digits: 10 },
    { code: "+1", iso: "DO", name: "Rep. Dominicana", digits: 10 },
    { code: "+598", iso: "UY", name: "Uruguay", digits: 8 },
    { code: "+58", iso: "VE", name: "Venezuela", digits: 10 },

    // Norteamérica
    { code: "+1", iso: "US", name: "Estados Unidos", digits: 10 },
    { code: "+1", iso: "CA", name: "Canadá", digits: 10 },

    // Europa
    { code: "+34", iso: "ES", name: "España", digits: 9 },
    { code: "+351", iso: "PT", name: "Portugal", digits: 9 },
    { code: "+33", iso: "FR", name: "Francia", digits: 9 },
    { code: "+39", iso: "IT", name: "Italia", digits: 10 },
    { code: "+49", iso: "DE", name: "Alemania", digits: 11 },
    { code: "+44", iso: "GB", name: "Reino Unido", digits: 10 },
    { code: "+41", iso: "CH", name: "Suiza", digits: 9 },
    { code: "+31", iso: "NL", name: "Países Bajos", digits: 9 },
    { code: "+32", iso: "BE", name: "Bélgica", digits: 9 },

    // Otros frecuentes
    { code: "+971", iso: "AE", name: "Emiratos Árabes", digits: 9 },
    { code: "+61", iso: "AU", name: "Australia", digits: 9 },
    { code: "+86", iso: "CN", name: "China", digits: 11 },
];

/** Indicativo por defecto (Colombia). Se usa para clientes sin país guardado. */
export const DEFAULT_PHONE_COUNTRY = "+57";

/**
 * Clave única para el selector (code puede repetirse, ej. +1 en US/CA/PR/DO).
 * Usamos iso para distinguir, y así poder recuperar el país elegido.
 */
export function phoneCountryKey(c: PhoneCountry): string {
    return `${c.iso}|${c.code}`;
}

/** Devuelve el país por su clave (iso|code), o Colombia si no se encuentra. */
export function getPhoneCountryByKey(key?: string | null): PhoneCountry {
    const found = PHONE_COUNTRIES.find((c) => phoneCountryKey(c) === key);
    return found ?? PHONE_COUNTRIES[0];
}

/** Devuelve el primer país que coincide con un indicativo (ej. "+57"). */
export function getPhoneCountry(code?: string | null): PhoneCountry {
    const found = PHONE_COUNTRIES.find((c) => c.code === code);
    return found ?? PHONE_COUNTRIES[0];
}
