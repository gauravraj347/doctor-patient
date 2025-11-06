import { ChildEntity, Column } from 'typeorm';
import { UserRole } from './common';
import { User } from './User';

@ChildEntity(UserRole.PATIENT)
export class Patient extends User {
  @Column({ nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  address: string;

}