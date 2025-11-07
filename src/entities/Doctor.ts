import { ChildEntity, Column } from 'typeorm';
import { UserRole } from './common';
import { User } from './User';

@ChildEntity(UserRole.DOCTOR)
export class Doctor extends User {
  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  licenseNumber: string;

}