import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user/user.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);

  const testUser = {
    username: 'testuser',
    password: 'test1234',
    email: 'test@example.com',
    role: 'admin'
  };

  try {
    console.log('=== Creating test user ===');
    
    // Check if user already exists
    try {
      const existingUser = await userService.findByUsername(testUser.username);
      if (existingUser) {
        console.log('Test user already exists. Updating password...');
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        existingUser.password = hashedPassword;
        await existingUser.save();
        console.log('Test user password updated');
      } else {
        // Create new user
        console.log('Creating new test user...');
        await userService.create({
          username: testUser.username,
          password: testUser.password,
          email: testUser.email,
          role: testUser.role
        });
        console.log('Test user created successfully');
      }
      
      console.log('Test user credentials:');
      console.log('Username:', testUser.username);
      console.log('Password:', testUser.password);
      
    } catch (error) {
      console.error('Error creating test user:', error);
    }
    
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
