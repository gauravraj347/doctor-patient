import { Entity, Column, OneToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './common';

@Entity('doctor_availability')
export class DoctorAvailability extends BaseEntity {
  @OneToOne('Doctor', 'availability')
  doctor: any;

  @Column({ type: 'json', nullable: true })
  weeklySchedule: {
    monday: { start: string; end: string; isAvailable: boolean };
    tuesday: { start: string; end: string; isAvailable: boolean };
    wednesday: { start: string; end: string; isAvailable: boolean };
    thursday: { start: string; end: string; isAvailable: boolean };
    friday: { start: string; end: string; isAvailable: boolean };
    saturday: { start: string; end: string; isAvailable: boolean };
    sunday: { start: string; end: string; isAvailable: boolean };
  };

  @Column({ default: 30 })
  slotDuration: number; // in minutes

  @Column({ default: 15 })
  bufferTime: number; // break between appointments in minutes

  @Column({ default: 7 })
  advanceBookingDays: number; // how many days in advance can patients book

  @OneToMany('TimeSlot', 'availability')
  timeSlots: any[];
}