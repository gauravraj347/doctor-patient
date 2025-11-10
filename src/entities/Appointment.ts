import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { Patient } from './Patient';
import { TimeSlot } from './TimeSlot';

export enum AppointmentStatus {
  SCHEDULED = 'Scheduled',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
}

@Entity('appointments')
export class Appointment extends BaseEntity {
  @ManyToOne(() => Patient, (patient) => patient.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  patientId: string;

  @ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slotId' })
  timeSlot: TimeSlot;

  @Column()
  slotId: string;

  @Column({ type: 'date' })
  appointmentDate: Date;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ type: 'time' })
  reportingTime: string;

  @Column({ nullable: true })
  tokenNumber: number;
}
