/**
 * Departamentos y ciudades de Colombia.
 * Estructura: departamento → ciudades principales.
 */
export const COLOMBIA_DEPARTMENTS: Record<string, string[]> = {
  Amazonas: ["Leticia", "Puerto Nariño"],
  Antioquia: ["Medellín", "Bello", "Itagüí", "Envigado", "Apartadó", "Turbo", "Rionegro", "Caucasia", "Sabaneta", "Copacabana", "La Estrella", "Caldas", "Marinilla", "El Carmen de Viboral"],
  Arauca: ["Arauca", "Saravena", "Tame", "Fortul"],
  Atlántico: ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Galapa", "Baranoa", "Puerto Colombia"],
  Bolívar: ["Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar", "San Juan Nepomuceno"],
  Boyacá: ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa", "Puerto Boyacá", "Villa de Leyva"],
  Caldas: ["Manizales", "Villamaría", "La Dorada", "Chinchiná", "Riosucio", "Anserma"],
  Caquetá: ["Florencia", "San Vicente del Caguán", "Puerto Rico", "El Doncello"],
  Casanare: ["Yopal", "Aguazul", "Villanueva", "Tauramena", "Monterrey"],
  Cauca: ["Popayán", "Santander de Quilichao", "Puerto Tejada", "Piendamó", "El Tambo"],
  Cesar: ["Valledupar", "Aguachica", "Bosconia", "Codazzi", "La Jagua de Ibirico"],
  Chocó: ["Quibdó", "Istmina", "Tadó", "Condoto", "Bahía Solano"],
  Córdoba: ["Montería", "Cereté", "Lorica", "Sahagún", "Planeta Rica", "Montelíbano", "Tierralta"],
  Cundinamarca: ["Bogotá D.C.", "Soacha", "Facatativá", "Zipaquirá", "Chía", "Fusagasugá", "Girardot", "Mosquera", "Madrid", "Funza", "Cajicá", "Cota", "La Calera", "Sibaté", "Tocancipá"],
  Guainía: ["Inírida"],
  Guaviare: ["San José del Guaviare"],
  Huila: ["Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Manaure", "San Juan del Cesar"],
  Magdalena: ["Santa Marta", "Ciénaga", "Fundación", "El Banco", "Plato"],
  Meta: ["Villavicencio", "Acacías", "Granada", "Puerto López", "San Martín"],
  Nariño: ["Pasto", "Tumaco", "Ipiales", "La Unión", "Samaniego"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Los Patios", "Villa del Rosario", "El Zulia"],
  Putumayo: ["Mocoa", "Puerto Asís", "Orito", "Valle del Guamuez"],
  Quindío: ["Armenia", "Calarcá", "Montenegro", "La Tebaida", "Circasia"],
  Risaralda: ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  Santander: ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  Sucre: ["Sincelejo", "Corozal", "San Marcos", "Tolú", "Ovejas"],
  Tolima: ["Ibagué", "Espinal", "Melgar", "Honda", "Mariquita", "Chaparral"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Cartago", "Buga", "Jamundí", "Yumbo", "Candelaria"],
  Vaupés: ["Mitú"],
  Vichada: ["Puerto Carreño"],
};

export const DEPARTMENT_LIST = Object.keys(COLOMBIA_DEPARTMENTS).sort();

export function getCitiesByDepartment(department: string): string[] {
  return COLOMBIA_DEPARTMENTS[department] ?? [];
}
