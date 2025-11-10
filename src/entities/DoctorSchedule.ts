import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { Doctor } from './Doctor';

export enum ScheduleType {
  STREAM = 'stream',
  WAVE = 'wave',
}

@Entity('doctor_schedules')
export class DoctorSchedule extends BaseEntity {
  @OneToOne(() => Doctor, (doctor) => doctor.schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column()
  doctorId: string;

  @Column({ type: 'enum', enum: ScheduleType })
  scheduleType: ScheduleType;

  @Column({ type: 'time' })
  consultingStartTime: string;

  @Column({ type: 'time' })
  consultingEndTime: string;

  // For wave type scheduling
  @Column({ nullable: true })
  slotDuration: number; // in minutes

  @Column({ nullable: true })
  capacityPerSlot: number;

  // For stream type scheduling
  @Column({ nullable: true })
  totalCapacity: number;
}
