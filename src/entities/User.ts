import {
  Entity,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  TableInheritance,
} from 'typeorm';
import { BaseEntity, UserRole } from './common';
import * as bcrypt from 'bcryptjs';

@Entity('users')
@TableInheritance({ column: { type: 'enum', enum: UserRole, name: 'role' } })
export abstract class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true }) 
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany('RefreshToken', 'user')
  refreshTokens: any[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && this.password.length > 0) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) {
      return false; // OAuth users don't have passwords
    }
    return bcrypt.compare(password, this.password);
  }
}