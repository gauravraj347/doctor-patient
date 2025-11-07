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
    // Only hash if password exists, has content, and is not already hashed
    if (this.password && this.password.length > 0) {
      // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
      const isHashed = this.password.startsWith('$2a$') || this.password.startsWith('$2b$');
      if (!isHashed) {
        this.password = await bcrypt.hash(this.password, 12);
      }
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) {
      return false; // OAuth users don't have passwords
    }
    return bcrypt.compare(password, this.password);
  }
}