import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from './common';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column()
  token: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @ManyToOne('User', 'refreshTokens')
  user: any;
}