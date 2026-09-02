/**
 * The demo dataset.
 *
 * Separated from the runner so that what gets inserted is readable on its own,
 * and so the runner stays about ordering and idempotency rather than content.
 *
 * Passwords are here in plain text on purpose: these are throwaway development
 * accounts and hiding them would only make the project harder to try. The
 * runner refuses to touch a production database, which is what actually keeps
 * them harmless.
 */

export const SEED_PASSWORD = 'Reservas2026!';

export interface SeedUser {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export const USERS: SeedUser[] = [
  { email: 'admin@reservas.dev', name: 'Ana Lopez', role: 'admin' },
  { email: 'carlos@reservas.dev', name: 'Carlos Ruiz', role: 'user' },
  { email: 'marta@reservas.dev', name: 'Marta Diaz', role: 'user' },
];

export interface SeedResource {
  typeCode: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number | null;
  location: string | null;
  timeZone: string;
  isActive: boolean;
  /** Weekly operating hours, wall-clock in the resource's own zone. */
  schedule: { days: number[]; startTime: string; endTime: string }[];
}

/** Monday to Friday, as JavaScript's Date#getDay() numbers them. */
const WEEKDAYS = [1, 2, 3, 4, 5];

export const RESOURCES: SeedResource[] = [
  {
    typeCode: 'meeting-room',
    code: 'SALA-AURORA',
    name: 'Sala Aurora',
    description: 'Sala grande con pantalla y videoconferencia.',
    capacity: 12,
    location: 'Planta 2, ala norte',
    timeZone: 'Europe/Madrid',
    isActive: true,
    schedule: [{ days: WEEKDAYS, startTime: '08:00', endTime: '20:00' }],
  },
  {
    typeCode: 'meeting-room',
    code: 'SALA-BOREALIS',
    name: 'Sala Borealis',
    description: 'Sala pequeña para reuniones de equipo.',
    capacity: 6,
    location: 'Planta 1',
    timeZone: 'Europe/Madrid',
    isActive: true,
    schedule: [{ days: WEEKDAYS, startTime: '09:00', endTime: '18:00' }],
  },
  {
    typeCode: 'meeting-room',
    code: 'SALA-BOGOTA',
    name: 'Sala Bogotá',
    description: 'Sala del equipo de Colombia. Zona horaria distinta a propósito.',
    capacity: 8,
    location: 'Oficina Bogotá',
    // Deliberately not Europe/Madrid: with every resource in one zone, a bug
    // that ignores the resource's zone looks like correct behaviour.
    timeZone: 'America/Bogota',
    isActive: true,
    schedule: [{ days: WEEKDAYS, startTime: '08:00', endTime: '17:00' }],
  },
  {
    typeCode: 'laptop',
    code: 'PORT-014',
    name: 'Portátil 014',
    description: 'Portátil de préstamo para visitas.',
    capacity: null,
    location: 'Recepción',
    timeZone: 'Europe/Madrid',
    isActive: true,
    // No rows: available around the clock. Exercises the "no schedule" branch
    // of the availability service, which is easy to break and easy to miss.
    schedule: [],
  },
  {
    typeCode: 'car',
    code: 'COCHE-2891',
    name: 'Coche de empresa 2891',
    description: 'Reservable por días completos.',
    capacity: 5,
    location: 'Garaje -1',
    timeZone: 'Europe/Madrid',
    isActive: true,
    schedule: [{ days: [1, 2, 3, 4, 5, 6], startTime: '07:00', endTime: '22:00' }],
  },
  {
    typeCode: 'projector',
    code: 'PROY-003',
    name: 'Proyector 003',
    description: 'Retirado del servicio: sirve para ver un recurso desactivado.',
    capacity: null,
    location: 'Almacén',
    timeZone: 'Europe/Madrid',
    // Inactive on purpose: proves deactivation is visible in the list and that
    // the rules refuse to book it.
    isActive: false,
    schedule: [],
  },
];

export interface SeedReservation {
  resourceCode: string;
  userEmail: string;
  title: string;
  /** Days from today. Keeps the dataset in the future however old the clone. */
  dayOffset: number;
  /** Wall-clock in the resource's zone. */
  startTime: string;
  endTime: string;
  cancelled?: boolean;
}

/**
 * Reservations are placed relative to today rather than on fixed dates.
 *
 * A seed with hard-coded dates rots: six months from now every reservation is
 * in the past, the NotInThePastRule refuses to create them, and the list looks
 * empty on a fresh clone.
 */
export const RESERVATIONS: SeedReservation[] = [
  {
    resourceCode: 'SALA-AURORA',
    userEmail: 'admin@reservas.dev',
    title: 'Comité semanal',
    dayOffset: 1,
    startTime: '10:00',
    endTime: '11:00',
  },
  {
    // Starts exactly when the previous one ends. The pair is the seed's own
    // demonstration that [start, end) is half-open: this must be accepted, and
    // availability must not report a free minute between them.
    resourceCode: 'SALA-AURORA',
    userEmail: 'carlos@reservas.dev',
    title: 'Justo después',
    dayOffset: 1,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    resourceCode: 'SALA-AURORA',
    userEmail: 'marta@reservas.dev',
    title: 'Retro de equipo',
    dayOffset: 1,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    // Cancelled, and overlapping the 10:00 one above. Together they show that a
    // cancelled reservation frees its slot instantly -- the constraint is
    // filtered by status, so this row can coexist with the confirmed one.
    resourceCode: 'SALA-AURORA',
    userEmail: 'carlos@reservas.dev',
    title: 'Reunión anulada',
    dayOffset: 1,
    startTime: '10:30',
    endTime: '11:30',
    cancelled: true,
  },
  {
    resourceCode: 'SALA-BOREALIS',
    userEmail: 'marta@reservas.dev',
    title: 'Entrevista candidato',
    dayOffset: 2,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    // 09:00 in Bogotá is 15:00 in Madrid. If anything in the stack quietly
    // treats wall-clock as UTC, this row is where it shows.
    resourceCode: 'SALA-BOGOTA',
    userEmail: 'carlos@reservas.dev',
    title: 'Daily con Colombia',
    dayOffset: 2,
    startTime: '09:00',
    endTime: '09:30',
  },
  {
    resourceCode: 'PORT-014',
    userEmail: 'marta@reservas.dev',
    title: 'Portátil para visita',
    dayOffset: 3,
    startTime: '08:00',
    endTime: '18:00',
  },
];
