import { ChildEntity, Column, OneToOne, OneToMany } from 'typeorm';
import { UserRole } from './common';
import { User } from './User';

@ChildEntity(UserRole.DOCTOR)
export class Doctor extends User {
  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @OneToOne('DoctorSchedule', 'doctor')
  schedule: any;

  @OneToMany('TimeSlot', 'doctor')
  timeSlots: any[];
}