import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEvents } from './domain-events.service';

/** Global, so any service can inject `DomainEvents` without importing this module. */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class EventsModule {}
