import { ChildEntity, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { UserRole, DoctorStatus } from './common';
import { User } from './User';

@ChildEntity(UserRole.DOCTOR)
export class Doctor extends User {
  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  experience: number;

  @Column({ nullable: true })
  qualification: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ nullable: true })
  hospitalAffiliation: string;

  @Column({ nullable: true })
  consultationFee: number;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  profileImage: string;

  @Column({
    type: 'enum',
    enum: DoctorStatus,
    default: DoctorStatus.PENDING,
  })
  status: DoctorStatus;

  @OneToMany('Appointment', 'doctor')
  appointments: any[];

  @OneToOne('DoctorAvailability', 'doctor', {
    cascade: true,
  })
  @JoinColumn()
  availability: any;
}