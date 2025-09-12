import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user/user.service';
import { AuthService } from '../src/auth/auth.service';
import * as bcrypt from 'bcrypt';

// Add this to help with module resolution
const appModulePath = join(__dirname, '..', 'src', 'app.module');
console.log('App module path:', appModulePath);

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const authService = app.get(AuthService);

  const testUser = {
    username: 'testuser',
    password: 'test1234',
    email: 'test@example.com',
    role: 'admin'
  };

  try {
    console.log('\n=== Starting login test ===');
    
    // Try to find and delete test user if exists
    try {
      const existingUser = await userService.findByUsername(testUser.username);
      if (existingUser) {
        console.log('Removing existing test user...');
        // Use the public deleteUser method instead of accessing userModel directly
        await userService.deleteUser(existingUser._id.toString());
        console.log('Test user removed');
      }
    } catch (error) {
      console.log('No existing test user found or error removing user:', error.message);
    }

    // Create a test user
    console.log('\nCreating test user...');
    const createdUser = await userService.create({
      username: testUser.username,
      password: testUser.password,
      email: testUser.email,
      role: testUser.role
    });
    console.log('User created:', {
      id: createdUser.user._id,
      username: createdUser.user.username,
      role: createdUser.user.role
    });

    // Test login with correct credentials
    console.log('\nTesting login with correct credentials...');
    const loginResult = await authService.login(testUser.username, testUser.password);
    console.log('Login successful:', {
      userId: loginResult.userId,
      token: loginResult.access_token ? 'Token received' : 'No token',
      role: loginResult.role
    });

    // Test login with incorrect password
    console.log('\nTesting login with incorrect password...');
    try {
      await authService.login(testUser.username, 'wrongpassword');
      console.error('ERROR: Login with wrong password should have failed!');
    } catch (error) {
      console.log('Expected error (correct behavior):', error.message);
    }

    // Test login with non-existent user
    console.log('\nTesting login with non-existent user...');
    try {
      await authService.login('nonexistentuser', 'anypassword');
      console.error('ERROR: Login with non-existent user should have failed!');
    } catch (error) {
      console.log('Expected error (correct behavior):', error.message);
    }

    console.log('\n=== Test completed successfully ===');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
