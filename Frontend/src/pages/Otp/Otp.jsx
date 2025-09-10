import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBInput,
  MDBBtn,
} from "mdb-react-ui-kit";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Otp.css";

const Otp = () => {
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timer, setTimer] = useState(300);
  const navigate = useNavigate();
  const storedData = JSON.parse(localStorage.getItem("registerData"));

  useEffect(() => {
    if (!storedData) {
      toast.error("No registration data found. Redirecting...");
      setTimeout(() => navigate("/register"), 2000);
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate, storedData]);

  const formatTimer = () => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    // Remove 216 prefix if present
    if (cleaned.startsWith('216')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('00216')) {
      cleaned = cleaned.substring(5);
    }
    // Format as XX XXX XXX
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  };

  const handleVerify = useCallback(async () => {
    if (!/^\d{4}$/.test(otp)) {
      toast.error("OTP must be a 4-digit code.");
      return;
    }

    if (isSubmitting) {
      console.log("Duplicate verify attempt blocked");
      return;
    }
    
    setIsSubmitting(true);
    
    // Format phone number to match backend expectation (remove +216 prefix if present)
    let phoneNumber = storedData?.phoneNumber;
    if (phoneNumber.startsWith('+216')) {
      phoneNumber = phoneNumber.substring(4);
    } else if (phoneNumber.startsWith('00216')) {
      phoneNumber = phoneNumber.substring(5);
    }
    
    console.log("Sending verify request:", { phoneNumber, otp });

    try {
      const res = await axios.post(
        "http://localhost:3001/auth/verify-otp",
        { phoneNumber, otp }
      );
      
      console.log("Verify response:", res.data);

      if (res.status === 200 && res.data?.verified) {
        toast.success("OTP Verified! Redirecting to home...");
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", JSON.stringify(res.data.user));
        localStorage.removeItem("registerData");
        setOtp("");
        navigate("/home");
      } else {
        toast.error(res.data?.message || "Verification failed.");
      }
    } catch (err) {
      console.error("Verify error:", err.response?.data);
      const errorMessage =
        err?.response?.data?.message || "Error verifying OTP.";
      if (errorMessage.includes("Invalid or expired OTP")) {
        toast.error(
          "The OTP is invalid or has expired. Please resend a new OTP."
        );
      } else if (errorMessage.includes("Phone number already registered")) {
        toast.info("Account already created. Redirecting to home...");
        localStorage.setItem("isAuthenticated", "true");
        localStorage.removeItem("registerData");
        setTimeout(() => navigate("/home"), 2000);
      } else if (errorMessage.includes("User not found")) {
        toast.error("User not found. Please register again.");
        localStorage.removeItem("registerData");
        setTimeout(() => navigate("/register"), 2000);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [otp, isSubmitting, storedData, navigate]);

  const handleResendOtp = async () => {
    if (!storedData) {
      toast.error("No registration data found.");
      return;
    }

    setIsResending(true);
    try {
      // Format phone number to match backend expectation (remove +216 prefix if present)
      let phoneNumber = storedData.phoneNumber;
      if (phoneNumber.startsWith('+216')) {
        phoneNumber = phoneNumber.substring(4);
      } else if (phoneNumber.startsWith('00216')) {
        phoneNumber = phoneNumber.substring(5);
      }
      
      await axios.post("http://localhost:3001/auth/send-otp", { phoneNumber });
      toast.success("New OTP sent successfully!");
      setTimer(300);
      setOtp("");
    } catch (err) {
      console.error('Resend OTP error:', err);
      toast.error(err?.response?.data?.message || "Failed to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <MDBContainer className="otp-container my-5">
      <MDBRow center>
        <MDBCol md="6" className="p-4 shadow-lg form-box">
          <h2 className="text-center mb-4">🔑 Enter OTP Code</h2>
          <p className="text-center mb-4">
            Enter the 4-digit code sent to{" "}
            {formatPhoneNumber(storedData?.phoneNumber) || "your phone"}. It expires in{" "}
            {formatTimer()}. Ensure your phone number starts with +216 followed
            by 8 digits.
          </p>
          <div className="mb-4">
            <MDBInput
              label="Enter the 4-digit code"
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => {
                const digitsOnly = e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4);
                setOtp(digitsOnly);
              }}
              required
              autoComplete="one-time-code"
              disabled={isSubmitting || isResending}
            />
          </div>
          <MDBBtn
            block
            onClick={handleVerify}
            className="mb-3"
            disabled={isSubmitting || isResending}
          >
            {isSubmitting ? "Verifying..." : "Verify OTP"}
          </MDBBtn>
          <div className="text-center">
            <p>
              Didn't receive a code?{" "}
              <button
                className="resend-btn"
                onClick={handleResendOtp}
                disabled={isSubmitting || isResending || timer === 0}
              >
                {isResending ? "Resending..." : "Resend OTP"}
              </button>
            </p>
          </div>
        </MDBCol>
      </MDBRow>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
      />
    </MDBContainer>
  );
};

export default Otp;
