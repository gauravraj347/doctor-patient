import { Entity, Column } from 'typeorm';
import { BaseEntity } from './common';

@Entity('pending_oauth_users')
export class PendingOAuthUser extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  picture: string;

  @Column()
  expiresAt: Date;
}
