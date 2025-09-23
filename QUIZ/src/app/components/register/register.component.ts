import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  loading = false;
  submitted = false;
  phoneNumber: string = '';
  showOtpVerification = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.registerForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]]
    });
  }

  ngOnInit(): void {}

  get f() { return this.registerForm.controls; }

  // Handle change number request from OTP component
  onChangeNumberRequested(): void {
    this.showOtpVerification = false;
    this.registerForm.patchValue({
      phoneNumber: this.phoneNumber
    });
    // Focus the phone number input for better UX
    setTimeout(() => {
      const phoneInput = document.getElementById('phoneNumber') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();
      }
    }, 0);
  }

  onSubmit() {
    this.submitted = true;

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    const { phoneNumber, username } = this.registerForm.value;
    
    this.authService.register(phoneNumber, username).subscribe({
      next: (response) => {
        this.loading = false;
        this.phoneNumber = phoneNumber;
        this.showOtpVerification = true;
        this.toastr.success('OTP sent to your phone number');
      },
      error: (error) => {
        this.loading = false;
        this.toastr.error(error.error?.message || 'Registration failed. Please try again.');
      }
    });
  }
}
