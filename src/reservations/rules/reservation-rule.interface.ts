import { type EntityManager } from 'typeorm';
import { type Resource } from '../../resources/entities/resource.entity';
import { type Period } from '../period.vo';

/** Everything a rule may look at. Nothing else is in scope for one. */
export interface ReservationContext {
  readonly resource: Resource;
  readonly period: Period;
  readonly userId: string;
  readonly attendees?: number;
  /** Injected, never Date.now(), so "not in the past" is deterministic. */
  readonly now: Date;
  /** Set when rescheduling, so a reservation does not conflict with itself. */
  readonly excludedReservationId?: string;
}

/**
 * One business rule.
 *
 * A single method that either returns or throws. Interface segregation taken
 * literally: a rule cannot read, write or do anything but validate, so there
 * is nothing to misuse and the whole surface can be tested exhaustively.
 *
 * Adding a rule means adding a class and one entry in the array in
 * reservations.module.ts. ReservationService is never touched -- that is the
 * open/closed principle as something concrete rather than a slogan.
 */
export interface ReservationRule {
  /** Identifies the rule in logs. */
  readonly name: string;

  /**
   * Throws a DomainError when the context violates the rule.
   *
   * Receives the transaction's EntityManager because some rules query, and
   * they must see the same snapshot -- and the same advisory lock -- as the
   * service that called them.
   */
  check(context: ReservationContext, manager: EntityManager): Promise<void>;
}

/**
 * One of only two injection tokens in the backend.
 *
 * A class would be enough to substitute a single implementation. This token
 * does something a class cannot: inject a LIST of them, so the service
 * iterates rules without knowing any of them by name.
 */
export const RESERVATION_RULES = Symbol('RESERVATION_RULES');
