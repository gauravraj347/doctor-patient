import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { Doctor } from './Doctor';

@Entity('session_overrides')
export class SessionOverride extends BaseEntity {
  @Column()
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'date' })
  overrideDate: Date;

  @Column({ type: 'time' })
  originalStartTime: string;

  @Column({ type: 'time' })
  originalEndTime: string;

  @Column({ type: 'time' })
  newStartTime: string;

  @Column({ type: 'time' })
  newEndTime: string;

  // For wave type scheduling
  @Column({ nullable: true })
  originalSlotDuration: number;

  @Column({ nullable: true })
  newSlotDuration: number;

  @Column({ nullable: true })
  originalCapacityPerSlot: number;

  @Column({ nullable: true })
  newCapacityPerSlot: number;

  // For stream type scheduling
  @Column({ nullable: true })
  originalTotalCapacity: number;

  @Column({ nullable: true })
  newTotalCapacity: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ default: true })
  isActive: boolean;
}
