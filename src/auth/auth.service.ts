import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminRepository } from '../admin/repositories/admin.repository';
import { LoginDto, ChangePasswordDto, LoginResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const admin = await this.adminRepository.findByUsername(loginDto.username);
    
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, admin.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: admin.id, username: admin.username };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async changePassword(adminId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      admin.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.adminRepository.updatePassword(adminId, newPasswordHash);
  }

  async validateUser(payload: any) {
    const admin = await this.adminRepository.findOne({ where: { id: payload.sub } });
    return admin;
  }
}
