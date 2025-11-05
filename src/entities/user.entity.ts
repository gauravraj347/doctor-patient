import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RefreshToken } from './refresh-token.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ type: 'enum', enum: ['doctor', 'patient'], default: 'patient' })
  role: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ default: 'local' })
  provider: string;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}