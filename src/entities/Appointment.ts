import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity, AppointmentStatus } from './common';

@Entity('appointments')
export class Appointment extends BaseEntity {
  @ManyToOne('Patient', 'appointments')
  patient: any;

  @ManyToOne('Doctor', 'appointments')
  doctor: any;

  @OneToOne('TimeSlot', 'appointment')
  @JoinColumn()
  timeSlot: any;

  @Column()
  appointmentDate: Date;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  prescription: string;

  @Column({ nullable: true })
  diagnosis: string;

  @Column({ nullable: true })
  followUpDate: Date;

  @Column({ default: 0 })
  consultationFee: number;

  @Column({ default: false })
  isPaid: boolean;
}