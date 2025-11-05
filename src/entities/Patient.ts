import { ChildEntity, Column, OneToMany } from 'typeorm';
import { UserRole } from './common';
import { User } from './User';

@ChildEntity(UserRole.PATIENT)
export class Patient extends User {
  @Column({ nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  emergencyContact: string;

  @Column({ nullable: true })
  emergencyContactPhone: string;

  @Column({ nullable: true })
  medicalHistory: string;

  @Column({ nullable: true })
  allergies: string;

  @Column({ nullable: true })
  currentMedications: string;

  @OneToMany('Appointment', 'patient')
  appointments: any[];
}