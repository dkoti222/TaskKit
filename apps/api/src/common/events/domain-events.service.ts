import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from './domain-events';

/**
 * The one way services publish domain events. It only adds types on top of EventEmitter2:
 * the event name is `event.type`, and the payload is the whole event.
 *
 * Call it AFTER the write has succeeded (after `await`), never inside a transaction, so
 * listeners never hear about a change that was rolled back.
 */
@Injectable()
export class DomainEvents {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: DomainEvent) {
    this.emitter.emit(event.type, event);
  }
}
