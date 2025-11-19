import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { Appointment } from './Appointment';
import { SessionOverride } from './SessionOverride';

export enum AdjustmentType {
  MOVED = 'MOVED',
  REDISTRIBUTED = 'REDISTRIBUTED',
  NEEDS_RESCHEDULE = 'NEEDS_RESCHEDULE',
  CANCELLED = 'CANCELLED',
  REASSIGNED = 'REASSIGNED',
  TIME_RECALCULATED = 'TIME_RECALCULATED',
}

@Entity('appointment_adjustment_logs')
export class AppointmentAdjustmentLog extends BaseEntity {
  @Column()
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column()
  sessionOverrideId: string;

  @ManyToOne(() => SessionOverride, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionOverrideId' })
  sessionOverride: SessionOverride;

  @Column({ type: 'enum', enum: AdjustmentType })
  adjustmentType: AdjustmentType;

  @Column({ type: 'time', nullable: true })
  oldReportingTime: string;

  @Column({ type: 'time', nullable: true })
  newReportingTime: string;

  @Column({ nullable: true })
  oldSlotId: string;

  @Column({ nullable: true })
  newSlotId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  patientNotified: boolean;
}
