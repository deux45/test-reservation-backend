import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';

/**
 * Serialises reservation writes for a single resource.
 *
 * Layer 2 of the three defences. Without it, two concurrent requests for the
 * same slot both run the overlap query, both see nothing, and both proceed to
 * insert -- at which point the EXCLUDE constraint saves correctness but one
 * caller gets an opaque database error instead of a useful 409.
 *
 * An advisory lock rather than SELECT ... FOR UPDATE on the resource row:
 * this locks exactly the operation "creating reservations for this resource",
 * so it does not block a legitimate edit of the resource itself, and it does
 * not require the row to exist. Requests for different resources never
 * contend.
 *
 * Rejected alternative: SERIALIZABLE isolation. It would work, but it turns
 * contention into serialisation failures that every caller must retry, which
 * is more machinery for a worse error message.
 */
@Injectable()
export class ReservationLockService {
  async acquire(resourceId: string, manager: EntityManager): Promise<void> {
    // hashtextextended gives a stable bigint from the uuid.
    //
    // pg_advisory_xact_lock, not pg_advisory_lock: the _xact_ variant is
    // released when the transaction ends, including on rollback or a dropped
    // connection. The session-scoped one would leak a held lock on any path
    // that does not reach an explicit unlock, and deadlock the resource for
    // as long as the connection lives.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [resourceId]);
  }
}
