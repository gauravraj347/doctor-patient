import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './common';
import { User } from './User';

@Entity('verification_tokens')
export class VerificationToken extends BaseEntity {
  @Column()
  otp: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;
}
