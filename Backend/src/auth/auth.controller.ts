import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
// To protect admin routes
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/user/roles.guard';
import { JwtAuthGuard } from 'src/user/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Login method
  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    const { username, password } = loginDto;
    return this.authService.login(username, password);
  }

  // Admin creates a new user
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createAdminUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.createAdminUser(createUserDto);
  }
}
