import { Entity, Column, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from './common';

@Entity('time_slots')
export class TimeSlot extends BaseEntity {
  @Column()
  date: Date;

  @Column()
  startTime: string; // Format: "HH:MM"

  @Column()
  endTime: string; // Format: "HH:MM"

  @Column({ default: true })
  isAvailable: boolean;

  @ManyToOne('DoctorAvailability', 'timeSlots')
  availability: any;

  @OneToOne('Appointment', 'timeSlot')
  appointment: any;
}