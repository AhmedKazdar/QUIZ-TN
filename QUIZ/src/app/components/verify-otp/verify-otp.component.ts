import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.scss']
})
export class VerifyOtpComponent implements OnInit, OnDestroy {

  @Input() phoneNumber: string = '';
  @Input() username: string = '';
  @Output() changeNumberRequested = new EventEmitter<void>();
  
  otpForm: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';
  countdown = 60;
  canResend = false;
  private countdownInterval: any;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {
    // Initialize form with 4 digit inputs
    const controls: { [key: string]: FormControl } = {};
    for (let i = 0; i < 4; i++) {
      controls[`digit${i}`] = new FormControl('', [
        Validators.required,
        Validators.pattern(/^[0-9]$/)
      ]);
    }
    this.otpForm = this.formBuilder.group(controls);
  }

  ngOnInit(): void {
    console.log('[OTP] VerifyOtpComponent.ngOnInit');
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  // Get the OTP value from form controls
  private getOtpValue(): string {
    return Object.values(this.otpForm.value)
      .slice(0, 4) // Ensure we only take 4 digits
      .join('');
  }

  // Handle OTP form submission
  onSubmit(): void {
    console.log('[OTP] onSubmit clicked');
    this.submitted = true;
    this.errorMessage = '';

    if (this.otpForm.invalid) {
      this.errorMessage = 'Please enter a valid 4-digit OTP';
      return;
    }

    this.loading = true;
    const otp = this.getOtpValue();
    console.log('[OTP] Submitting OTP', { otp, phoneNumber: this.phoneNumber, username: this.username });
    
    // Include username in the OTP verification for new users
    this.authService.verifyOtp(this.phoneNumber, otp, this.username).subscribe({
      next: (response) => {
        console.log('[OTP] Verification response:', response);
        
        // Check if user is properly authenticated
        const currentUser = this.authService.currentUserValue;
        console.log('[OTP] Current user after verification:', currentUser);
        
        if (!currentUser || !currentUser.token) {
          throw new Error('Authentication failed: No user or token found');
        }
        
        this.loading = false;
        this.toastr.success('Phone number verified successfully!');
        
        // Navigate to welcome page
        this.router.navigate(['/home']).then(success => {
          if (!success) {
            console.error('[OTP] Navigation to /welcome failed');
            this.toastr.error('Failed to navigate to welcome page');
          }
        });
      },
      error: (error) => {
        this.loading = false;
        console.error('[OTP] Verification error (onSubmit):', error);
        
        // Handle different types of errors
        let errorMessage = 'An error occurred during verification';
        
        if (error.status === 0) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.status === 400 || error.status === 401) {
          errorMessage = error.error?.message || 'Invalid or expired OTP. Please try again.';
        } else if (error.status === 404) {
          errorMessage = 'User not found. Please register first.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        this.errorMessage = errorMessage;
        this.toastr.error(errorMessage);
        
        // Clear the form on error
        this.otpForm.reset();
      }
    });
  }

  // Handle resend OTP
  resendOtp(): void {
    if (!this.canResend) return;
    
    this.loading = true;
    this.errorMessage = '';
    
    this.authService.register(this.phoneNumber).subscribe({
      next: () => {
        this.loading = false;
        this.toastr.success('A new OTP has been sent to your phone');
        this.startCountdown();
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Failed to resend OTP. Please try again.';
      }
    });
  }

  // Handle change number request
  changeNumber(event: Event): void {
    event.preventDefault();
    this.changeNumberRequested.emit();
  }

  // Handle countdown timer for resend OTP
  private startCountdown(): void {
    this.canResend = false;
    this.countdown = 60;
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.canResend = true;
      }
    }, 1000);
  }

  // Handle OTP input navigation
  onKeyUp(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Move to next input if a digit was entered
    if (value && index < 3) {  
      const nextInput = document.querySelector(`input[formControlName="digit${index + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
  }

  // Handle backspace navigation between OTP inputs
  onKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    const prevInput = input.previousElementSibling as HTMLInputElement;
    
    // Handle backspace
    if (event.key === 'Backspace' && !input.value && prevInput) {
      event.preventDefault();
      prevInput.focus();
    }
  }

  // Handle paste event for OTP
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData?.getData('text/plain').trim() || '';
    const otpDigits = clipboardData.replace(/\D/g, '').split('').slice(0, 4);
    
    if (otpDigits.length === 4) {  
      const formValues: { [key: string]: string } = {};
      otpDigits.forEach((digit, i) => {
        formValues[`digit${i}`] = digit;
      });
      this.otpForm.patchValue(formValues);
      
      // Auto-submit if 4 digits are pasted
      if (otpDigits.length === 4) {
        this.onSubmit();
      }
    }
  }

  // Handle input event for validation
  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    // Ensure only numbers are entered
    input.value = input.value.replace(/[^0-9]/g, '');
  }

  verifyOtp(otp: string): void {
    this.loading = true;
    this.authService.verifyOtp(this.phoneNumber, otp, this.username).subscribe({
      next: (response: any) => {  // Add type annotation
        this.loading = false;
        console.log('[OTP] Verification succeeded (verifyOtp method).', {
          phoneNumber: this.phoneNumber,
          username: this.username,
          response
        });
        this.navigateAfterLogin();
      },
      error: (error: any) => {  // Add type annotation
        this.loading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Verification failed';
      }
    });
  }

  // Decide where to go after successful verification
  private navigateAfterLogin(): void {
    console.log('[OTP] navigateAfterLogin called');
    
    // Check if user is authenticated
    const isAuthenticated = this.authService.isAuthenticated();
    console.log('[OTP] User authenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
      console.error('[OTP] User not authenticated after verification');
      this.toastr.error('Authentication failed. Please try again.');
      return;
    }
    
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    console.log('[OTP] Return URL from query params:', returnUrl);
    
    // If user came from an in-quiz route, take them to the Welcome page instead
    if (returnUrl && !returnUrl.startsWith('/quiz/online')) {
      console.log('[OTP] Navigating to provided returnUrl:', returnUrl);
      this.router.navigateByUrl(returnUrl).catch(err => {
        console.error('[OTP] Navigation to returnUrl failed:', err);
        this.router.navigate(['/home']);
      });
      return;
    }
    
    // Default welcome page showing modes and greeting
    console.log('[OTP] Navigating to /welcome');
    this.router.navigate(['/home']).catch(err => {
      console.error('[OTP] Navigation to /welcome failed:', err);
    });
  }
}
