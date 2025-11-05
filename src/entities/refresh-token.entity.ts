import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column()
  token: string;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;
}